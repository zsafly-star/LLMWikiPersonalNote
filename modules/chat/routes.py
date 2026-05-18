from flask import Blueprint, request, render_template, Response, stream_with_context, jsonify
import json
from common.llm import LLMService
from .services import ChatService
from common.response import success_response, error_response

chat_bp = Blueprint('chat', __name__, template_folder='templates')


@chat_bp.route('/chat')
def chat_page():
    return render_template('chat.html', active_view='chat')


@chat_bp.route('/api/chat/sessions', methods=['GET'])
def get_sessions():
    sessions = ChatService.get_all_sessions()
    return success_response(sessions)


@chat_bp.route('/api/chat/sessions', methods=['POST'])
def create_session():
    data = request.get_json() or {}
    model_name = data.get('model_name')
    session = ChatService.create_session(model_name)
    return success_response(session, '创建成功')


@chat_bp.route('/api/chat/sessions/<int:session_id>', methods=['GET'])
def get_session(session_id):
    session = ChatService.get_session_with_messages(session_id)
    if session:
        return success_response(session)
    return error_response('会话不存在', 404)


@chat_bp.route('/api/chat/sessions/<int:session_id>', methods=['DELETE'])
def delete_session(session_id):
    success = ChatService.delete_session(session_id)
    if success:
        return success_response(None, '删除成功')
    return error_response('会话不存在', 404)


@chat_bp.route('/api/chat/sessions/<int:session_id>/messages', methods=['POST'])
def send_message(session_id):
    data = request.get_json()
    if not data or 'content' not in data:
        return error_response('缺少消息内容')

    try:
        use_wiki = data.get('use_wiki', False)
        response = ChatService.chat(session_id, data['content'], use_wiki=use_wiki)
        session = ChatService.get_session_with_messages(session_id)
        return success_response(session, '发送成功')
    except ValueError as e:
        return error_response(str(e), 404)
    except Exception as e:
        return error_response(f'发送失败: {str(e)}')


@chat_bp.route('/api/chat/sessions/<int:session_id>/stream', methods=['POST'])
def stream_message(session_id):
    data = request.get_json()
    if not data or 'content' not in data:
        return error_response('缺少消息内容')

    session = ChatService.get_session(session_id)
    if not session:
        return error_response('会话不存在', 404)

    use_wiki = data.get('use_wiki', False)
    user_message = data['content']

    from common.llm_config import LLMConfigService
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
        from .models import ChatSession
        s = ChatSession.query.get(session_id)
        provider, model = s.model_name.split('/')
        kwargs = {}

    ChatService.add_message(session_id, 'user', user_message)

    from .models import ChatMessage
    messages = ChatMessage.query.filter_by(session_id=session_id)\
        .order_by(ChatMessage.created_at.asc()).all()
    message_history = [{'role': m.role, 'content': m.content} for m in messages]

    if use_wiki:
        wiki_prompt = ChatService._build_wiki_prompt()
        message_history.insert(0, {'role': 'system', 'content': wiki_prompt})

    def generate():
        full_response = ''
        full_thinking = ''
        sep = '\n\n'
        stream_complete = False

        stream_msg = ChatService.add_message(session_id, 'assistant', '')
        stream_msg_id = stream_msg.id

        try:
            for chunk in LLMService.stream_chat(provider, model, message_history, **kwargs):
                chunk_type = chunk.get('type', 'content')
                chunk_text = chunk.get('content', '')
                if chunk_type == 'thinking':
                    full_thinking += chunk_text
                    payload = json.dumps({'thinking': chunk_text}, ensure_ascii=False)
                else:
                    full_response += chunk_text
                    payload = json.dumps({'chunk': chunk_text}, ensure_ascii=False)
                yield f"data: {payload}{sep}"
                ChatService.update_message(stream_msg_id, full_response)
            stream_complete = True
        except Exception as e:
            if not full_response:
                full_response = f"模型调用失败: {str(e)}"
                payload = json.dumps({'chunk': full_response}, ensure_ascii=False)
                yield f"data: {payload}{sep}"
        finally:
            if full_thinking:
                full_response = '<details>\n<summary>思考过程</summary>\n\n' + full_thinking + '\n\n</details>\n\n' + full_response
            ChatService.update_message(stream_msg_id, full_response)

            if not stream_complete:
                return

            from .models import ChatSession
            session_obj = ChatSession.query.get(session_id)
            if session_obj and session_obj.name and session_obj.name.startswith('会话 '):
                try:
                    title_prompt = [
                        {'role': 'system', 'content': '请根据用户的第一条消息，用4-10个汉字概括对话主题，直接输出标题，不要加引号、不要有多余内容。'},
                        {'role': 'user', 'content': user_message}
                    ]
                    title = LLMService.chat(provider, model, title_prompt, **kwargs)
                    title = title.strip().strip('"\'""''')
                    if title and len(title) <= 30:
                        session_obj.name = title
                        from extensions import db
                        db.session.commit()
                except Exception:
                    pass

            updated = ChatService.get_session_with_messages(session_id)
            session_name = updated['session']['name'] if updated else ''
            payload = json.dumps({'done': True, 'session_name': session_name}, ensure_ascii=False)
            yield f"data: {payload}{sep}"

    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
        }
    )


@chat_bp.route('/api/chat/sessions/<int:session_id>/to-article', methods=['POST'])
def chat_to_article(session_id):
    data = request.get_json()
    title = data.get('title') if data else None
    folder_path = data.get('folder_path') if data else None

    try:
        article = ChatService.chat_to_article(session_id, title, folder_path)
        return success_response(article, '保存成功')
    except ValueError as e:
        return error_response(str(e), 404)
    except Exception as e:
        return error_response(f'保存失败: {str(e)}')


@chat_bp.route('/api/chat/messages/<int:message_id>', methods=['DELETE'])
def delete_message(message_id):
    try:
        ChatService.delete_message_pair(message_id)
        return success_response(None, '删除成功')
    except ValueError as e:
        return error_response(str(e), 404)
    except Exception as e:
        return error_response(f'删除失败: {str(e)}')


@chat_bp.route('/api/chat/models', methods=['GET'])
def get_models():
    models = LLMService.get_all_models()
    return success_response(models)


@chat_bp.route('/api/chat/active-config', methods=['GET'])
def get_active_config():
    from common.llm_config import LLMConfigService
    config = LLMConfigService.get_active()
    if not config:
        return success_response(None)
    return success_response({
        'provider': config.provider,
        'model': config.model,
        'name': config.name,
    })


# 兼容旧版 API 端点
@chat_bp.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    """获取聊天历史（兼容旧版）"""
    sessions = ChatService.get_all_sessions()
    messages = []
    for session in sessions:
        session_messages = session.get('messages', [])
        for msg in session_messages:
            messages.append({
                'role': msg.get('role'),
                'content': msg.get('content'),
                'timestamp': msg.get('created_at', 0)
            })
    return success_response(messages)


@chat_bp.route('/api/chat/history', methods=['DELETE'])
def clear_chat_history():
    """清除聊天历史（兼容旧版）"""
    sessions = ChatService.get_all_sessions()
    for session in sessions:
        session_id = session.get('id')
        if session_id:
            ChatService.delete_session(session_id)
    return success_response(None, '清除成功')


@chat_bp.route('/api/chat/completion', methods=['POST'])
def chat_completion():
    """聊天完成接口（兼容旧版）"""
    data = request.get_json()
    if not data or 'message' not in data:
        return error_response('缺少消息内容')

    try:
        model = data.get('model', 'default')
        session = ChatService.create_session(model)
        session_id = session.get('id')
        
        response = ChatService.chat(session_id, data['message'])
        return success_response({
            'response': response
        })
    except Exception as e:
        return error_response(f'请求失败: {str(e)}')
