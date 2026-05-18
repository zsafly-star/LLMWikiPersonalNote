import os

from flask import Blueprint, request, render_template
from common.response import success_response, error_response
from extensions import db
from .models import WikiPage
from . import wiki_service, wiki_compiler
from modules.chat.models import ChatSession, ChatMessage

wiki_bp = Blueprint('wiki', __name__, template_folder='templates')


@wiki_bp.route('/wiki')
def wiki_page():
    return render_template('wiki.html', active_view='wiki')


@wiki_bp.route('/graph')
def graph_page():
    return render_template('graph.html', active_view='graph')


@wiki_bp.route('/api/wiki/sources', methods=['GET'])
def get_sources():
    files = wiki_service.scan_article_files()
    compiled_hashes = wiki_service.load_source_hashes()

    for f in files:
        f['status'] = 'compiled' if f['title'] in compiled_hashes and compiled_hashes[f['title']] == f['hash'] else 'pending'
        del f['content']

    return success_response(files)


@wiki_bp.route('/api/wiki/compile', methods=['POST'])
def api_compile_wiki():
    from flask import current_app
    app = current_app._get_current_object()
    data = request.get_json() or {}
    incremental = data.get('incremental', True)
    init = data.get('init', False)
    result = wiki_compiler.compile_wiki(app, incremental=incremental, init=init)
    return success_response(result)


@wiki_bp.route('/api/wiki/status', methods=['GET'])
def get_compile_status():
    status = wiki_compiler.get_compile_status()
    return success_response(status)


@wiki_bp.route('/api/wiki/pages', methods=['GET'])
def get_pages():
    pages = WikiPage.query.order_by(WikiPage.updated_at.desc()).all()
    return success_response([p.to_dict() for p in pages])


@wiki_bp.route('/api/wiki/pages/<slug>', methods=['GET'])
def get_page(slug):
    page = WikiPage.query.filter_by(slug=slug).first()
    if not page:
        return error_response('页面不存在', 404)

    page_dict = page.to_dict()

    file_data = wiki_service.read_concept_page(slug)
    if file_data:
        page_dict['body'] = file_data['body']

    return success_response(page_dict)


@wiki_bp.route('/api/wiki/pages/<slug>', methods=['DELETE'])
def delete_page(slug):
    page = WikiPage.query.filter_by(slug=slug).first()
    if not page:
        return error_response('页面不存在', 404)

    wiki_service.delete_concept_page(slug)
    db.session.delete(page)
    db.session.commit()
    return success_response(None, '删除成功')


@wiki_bp.route('/api/wiki/index', methods=['GET'])
def get_index():
    index_path = os.path.join(wiki_service.get_wiki_root(), 'index.md')
    if not os.path.isfile(index_path):
        wiki_service.generate_index()

    if os.path.isfile(index_path):
        with open(index_path, 'r', encoding='utf-8') as f:
            content = f.read()
        return success_response({'content': content})

    return success_response({'content': ''})


@wiki_bp.route('/api/wiki/query', methods=['POST'])
def query_wiki():
    data = request.get_json()
    question = data.get('question', '').strip()
    save = data.get('save', False)

    if not question:
        return error_response('请输入问题')

    try:
        result = wiki_compiler.query_wiki(question, save=save)
        return success_response(result)
    except RuntimeError as e:
        return error_response(str(e))
    except Exception as e:
        return error_response(f'查询失败: {str(e)}')


@wiki_bp.route('/api/wiki/queries', methods=['GET'])
def get_queries():
    queries = wiki_service.list_query_pages()
    return success_response(queries)


@wiki_bp.route('/api/wiki/graph', methods=['GET'])
def get_graph():
    pages = WikiPage.query.all()
    nodes = []
    edges = []
    slug_set = set()
    slug_title_map = {}

    for p in pages:
        pd = p.to_dict()
        slug_set.add(pd['slug'])
        slug_title_map[pd['slug']] = pd['title']
        nodes.append({
            'id': pd['slug'],
            'label': pd['title'],
            'kind': pd.get('kind', 'concept'),
            'size': len(pd.get('links', [])) + 1,
        })

    added_edges = set()
    for p in pages:
        pd = p.to_dict()
        for link in pd.get('links', []):
            target_slug = link.lower().replace(' ', '_').replace('/', '_')
            matched_slug = None

            if target_slug in slug_set:
                matched_slug = target_slug
            else:
                for s in slug_set:
                    if link in slug_title_map.get(s, '') or slug_title_map.get(s, '') in link:
                        matched_slug = s
                        break
                if not matched_slug:
                    for s in slug_set:
                        if target_slug in s or s in target_slug:
                            matched_slug = s
                            break

            if matched_slug:
                edge_key = f"{pd['slug']}->{matched_slug}"
                if edge_key not in added_edges:
                    added_edges.add(edge_key)
                    edges.append({
                        'source': pd['slug'],
                        'target': matched_slug,
                    })

    return success_response({'nodes': nodes, 'edges': edges})


WIKI_CHAT_NAME = 'Wiki 对话'


def _get_or_create_wiki_session():
    session = ChatSession.query.filter_by(name=WIKI_CHAT_NAME).order_by(ChatSession.id.desc()).first()
    if session:
        return session

    from common.llm_config import LLMConfigService
    config = LLMConfigService.get_active()
    if not config:
        raise RuntimeError('未配置 LLM')

    provider = config.provider
    model = config.model or 'gpt-4o'
    model_name = f'{provider}/{model}'

    session = ChatSession(name=WIKI_CHAT_NAME, model_name=model_name)
    db.session.add(session)
    db.session.commit()
    return session


def _build_wiki_system_prompt():
    pages = WikiPage.query.order_by(WikiPage.updated_at.desc()).all()
    if not pages:
        return '你是一个知识助手。目前 Wiki 知识库中还没有内容，请先编译知识库。'

    lines = ['你是一个知识助手，以下是当前 Wiki 知识库中所有概念的摘要信息，请基于这些知识回答用户的问题。\n']
    lines.append('## 知识库概念列表\n')
    for p in pages:
        summary = p.summary or ''
        lines.append(f'- **{p.title}**: {summary}')
    lines.append('\n请用中文回答。如果知识库中没有相关信息，请说明。回答时可以引用相关概念。')
    return '\n'.join(lines)


@wiki_bp.route('/api/wiki/chat/sessions', methods=['GET'])
def get_wiki_chat_sessions():
    sessions = ChatSession.query.filter_by(name=WIKI_CHAT_NAME).order_by(ChatSession.updated_at.desc()).all()
    return success_response([s.to_dict() for s in sessions])


@wiki_bp.route('/api/wiki/chat/sessions', methods=['POST'])
def create_wiki_chat_session():
    try:
        session = _get_or_create_wiki_session()
        return success_response(session.to_dict())
    except RuntimeError as e:
        return error_response(str(e))


@wiki_bp.route('/api/wiki/chat/sessions/<int:session_id>', methods=['GET'])
def get_wiki_chat_session(session_id):
    session = ChatSession.query.filter_by(id=session_id, name=WIKI_CHAT_NAME).first()
    if not session:
        return error_response('会话不存在', 404)

    messages = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.created_at.asc()).all()
    return success_response({
        'session': session.to_dict(),
        'messages': [m.to_dict() for m in messages],
    })


@wiki_bp.route('/api/wiki/chat/sessions/<int:session_id>', methods=['DELETE'])
def delete_wiki_chat_session(session_id):
    session = ChatSession.query.filter_by(id=session_id, name=WIKI_CHAT_NAME).first()
    if not session:
        return error_response('会话不存在', 404)

    ChatMessage.query.filter_by(session_id=session_id).delete()
    db.session.delete(session)
    db.session.commit()
    return success_response(None, '删除成功')


@wiki_bp.route('/api/wiki/chat/sessions/<int:session_id>/messages', methods=['POST'])
def send_wiki_chat_message(session_id):
    session = ChatSession.query.filter_by(id=session_id, name=WIKI_CHAT_NAME).first()
    if not session:
        return error_response('会话不存在', 404)

    data = request.get_json()
    user_content = data.get('content', '').strip()
    if not user_content:
        return error_response('请输入消息')

    user_msg = ChatMessage(session_id=session_id, role='user', content=user_content)
    db.session.add(user_msg)
    db.session.commit()

    system_prompt = _build_wiki_system_prompt()

    history_msgs = ChatMessage.query.filter_by(session_id=session_id).order_by(ChatMessage.created_at.asc()).all()
    llm_messages = [{'role': 'system', 'content': system_prompt}]
    for m in history_msgs:
        llm_messages.append({'role': m.role, 'content': m.content})

    try:
        from common.llm import LLMService
        from common.llm_config import LLMConfigService
        config = LLMConfigService.get_active()
        if not config:
            raise RuntimeError('未配置 LLM')

        provider = config.provider
        model = config.model or 'gpt-4o'
        kwargs = {}
        if config.api_key:
            kwargs['api_key'] = config.api_key
        if config.base_url:
            kwargs['base_url'] = config.base_url

        adapter = LLMService.get_adapter(provider, **kwargs)
        answer = adapter.chat(llm_messages, model=model)

        if answer.startswith('OpenAI API 调用失败') or \
           answer.startswith('Claude API 调用失败') or \
           answer.startswith('Gemini API 调用失败') or \
           answer.startswith('Ollama API 调用失败') or \
           answer.startswith('未配置'):
            raise RuntimeError(answer)

        assistant_msg = ChatMessage(session_id=session_id, role='assistant', content=answer)
        db.session.add(assistant_msg)
        db.session.commit()

        return success_response({
            'user_message': user_msg.to_dict(),
            'assistant_message': assistant_msg.to_dict(),
        })
    except RuntimeError as e:
        return error_response(str(e))
    except Exception as e:
        return error_response(f'发送失败: {str(e)}')


@wiki_bp.route('/api/wiki/chat/messages/<int:message_id>/save', methods=['POST'])
def save_chat_message_to_wiki(message_id):
    message = ChatMessage.query.get(message_id)
    if not message or message.role != 'assistant':
        return error_response('消息不存在或不是 AI 回复')

    data = request.get_json() or {}
    title = data.get('title', '').strip()
    if not title:
        title = f'对话记录 {message.id}'

    body = message.content
    summary = body[:100] if len(body) > 100 else body

    slug = title.lower().replace(' ', '_').replace('/', '_')
    existing = WikiPage.query.filter_by(slug=slug).first()

    if existing:
        existing.body = body
        existing.summary = summary
        existing.updated_at = db.func.now()
    else:
        page = WikiPage(
            title=title,
            slug=slug,
            summary=summary,
            body=body,
            sources='[]',
            links='[]',
            kind='chat',
            confidence=0.7,
        )
        db.session.add(page)

    db.session.commit()
    wiki_service.save_concept_page(
        slug=slug,
        title=title,
        body=body,
        summary=summary,
        sources=[],
        kind='chat',
        confidence=0.7,
    )
    wiki_service.generate_index()

    return success_response({'slug': slug, 'title': title}, '保存到 Wiki 成功')
