from extensions import db
from common.llm import LLMService
from common.llm_config import LLMConfigService
from .models import ChatSession, ChatMessage


class ChatService:
    @staticmethod
    def create_session(model_name=None):
        if not model_name:
            config = LLMConfigService.get_active()
            if config:
                model_name = config.provider + '/' + (config.model or '')
            else:
                model_name = 'openai/gpt-3.5-turbo'
        session = ChatSession(
            name=f"会话 {ChatSession.query.count() + 1}",
            model_name=model_name
        )
        db.session.add(session)
        db.session.commit()
        return session.to_dict()

    @staticmethod
    def add_message(session_id, role, content):
        message = ChatMessage(
            session_id=session_id,
            role=role,
            content=content
        )
        db.session.add(message)
        db.session.commit()
        return message

    @staticmethod
    def update_message(message_id, content):
        message = ChatMessage.query.get(message_id)
        if message:
            message.content = content
            db.session.commit()
        return message

    @staticmethod
    def get_session(session_id):
        session = ChatSession.query.get(session_id)
        return session.to_dict() if session else None

    @staticmethod
    def get_session_with_messages(session_id):
        session = ChatSession.query.get(session_id)
        if not session:
            return None

        messages = ChatMessage.query.filter_by(session_id=session_id)\
            .order_by(ChatMessage.created_at.asc()).all()

        return {
            'session': session.to_dict(),
            'messages': [msg.to_dict() for msg in messages]
        }

    @staticmethod
    def get_all_sessions():
        sessions = ChatSession.query.order_by(ChatSession.updated_at.desc()).all()
        return [session.to_dict() for session in sessions]

    @staticmethod
    def delete_session(session_id):
        session = ChatSession.query.get(session_id)
        if not session:
            return False

        ChatMessage.query.filter_by(session_id=session_id).delete()
        db.session.delete(session)
        db.session.commit()
        return True

    @staticmethod
    def chat(session_id, user_message, use_wiki=False):
        session = ChatSession.query.get(session_id)
        if not session:
            raise ValueError("会话不存在")

        ChatService.add_message(session_id, 'user', user_message)

        messages = ChatMessage.query.filter_by(session_id=session_id)\
            .order_by(ChatMessage.created_at.asc()).all()

        message_history = [
            {'role': m.role, 'content': m.content}
            for m in messages
        ]

        if use_wiki:
            wiki_prompt = ChatService._build_wiki_prompt()
            message_history.insert(0, {'role': 'system', 'content': wiki_prompt})

        config = LLMConfigService.get_active()

        if config:
            provider = config.provider
            model = config.model or ''
            kwargs = {}
            if config.api_key:
                kwargs['api_key'] = config.api_key
            if config.base_url:
                kwargs['base_url'] = config.base_url
        else:
            provider, model = session.model_name.split('/')
            kwargs = {}

        try:
            response = LLMService.chat(provider, model, message_history, **kwargs)
        except Exception as e:
            response = f"模型调用失败: {str(e)}"

        ChatService.add_message(session_id, 'assistant', response)

        if session.name.startswith('会话 '):
            try:
                title_prompt = [
                    {'role': 'system', 'content': '请根据用户的第一条消息，用4-10个汉字概括对话主题，直接输出标题，不要加引号、不要有多余内容。'},
                    {'role': 'user', 'content': user_message}
                ]
                title = LLMService.chat(provider, model, title_prompt, **kwargs)
                title = title.strip().strip('"\'""''')
                if title and len(title) <= 30:
                    session.name = title
                    db.session.commit()
            except Exception:
                pass

        return response

    @staticmethod
    def chat_to_article(session_id, title=None, folder_path=None):
        session = ChatSession.query.get(session_id)
        if not session:
            raise ValueError("会话不存在")

        messages = ChatMessage.query.filter_by(session_id=session_id)\
            .order_by(ChatMessage.created_at.asc()).all()

        article_title = title or session.name
        content = f"# {article_title}\n\n"
        for message in messages:
            role = '用户' if message.role == 'user' else 'AI'
            content += f"## {role}\n\n{message.content}\n\n"

        from config import Config
        import os
        save_dir = folder_path if folder_path else Config.ARTICLE_PATH
        if not os.path.isdir(save_dir):
            os.makedirs(save_dir, exist_ok=True)
        safe_name = article_title.replace('/', '_').replace('\\', '_').replace(':', '_')
        file_path = os.path.join(save_dir, safe_name + '.md')
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)

        return {'title': article_title, 'path': file_path}

    @staticmethod
    def _build_wiki_prompt():
        from modules.wiki.models import WikiPage
        pages = WikiPage.query.order_by(WikiPage.updated_at.desc()).all()
        if not pages:
            return '你是一个知识助手。目前 Wiki 知识库中还没有内容，请先编译知识库。'

        lines = ['你是一个知识助手，以下是当前 Wiki 知识库中所有概念的摘要信息。请结合你自身的训练知识和这些知识库内容一起回答用户的问题，不要仅局限于知识库中的信息。\n']
        lines.append('## 知识库概念列表\n')
        for p in pages:
            summary = p.summary or ''
            lines.append(f'- **{p.title}**: {summary}')
        lines.append('\n请用中文回答。优先参考知识库中的内容，但也要结合你自身的知识给出更全面、深入的回答。')
        return '\n'.join(lines)

    @staticmethod
    def delete_message_pair(message_id):
        msg = ChatMessage.query.get(message_id)
        if not msg:
            raise ValueError("消息不存在")
        if msg.role != 'user':
            raise ValueError("只能删除用户消息")

        next_msg = ChatMessage.query.filter(
            ChatMessage.session_id == msg.session_id,
            ChatMessage.id > msg.id
        ).order_by(ChatMessage.id.asc()).first()

        db.session.delete(msg)
        if next_msg and next_msg.role == 'assistant':
            db.session.delete(next_msg)
        db.session.commit()
        return True
