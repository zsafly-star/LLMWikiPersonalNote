import os
import json
import hashlib
import threading

from extensions import db
from ..models import WikiPage
from .. import wiki_service


EMBEDDINGS_FILE = 'embeddings.json'
_embeddings_lock = threading.Lock()


def _embeddings_path():
    return os.path.join(wiki_service.get_wiki_root(), EMBEDDINGS_FILE)


def _load_embeddings():
    path = _embeddings_path()
    if os.path.isfile(path):
        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (json.JSONDecodeError, IOError):
            pass
    return {}


def _save_embeddings(data):
    path = _embeddings_path()
    with open(path, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _get_embedding_client():
    from common.llm_config import LLMConfigService
    config = LLMConfigService.get_active()
    if not config:
        raise RuntimeError('未配置 LLM')

    api_key = config.api_key
    base_url = config.base_url

    if not api_key:
        raise RuntimeError('未配置 API Key，无法生成 Embedding')

    import openai
    kwargs = {'api_key': api_key}
    if base_url:
        kwargs['base_url'] = base_url
    return openai.OpenAI(**kwargs)


def compute_embedding(text):
    client = _get_embedding_client()
    try:
        response = client.embeddings.create(
            model='text-embedding-3-small',
            input=text[:8000],
        )
        return response.data[0].embedding
    except Exception as e:
        raise RuntimeError(f"Embedding 计算失败: {str(e)}")


def _cosine_similarity(a, b):
    if not a or not b or len(a) != len(b):
        return 0.0
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = sum(x * x for x in a) ** 0.5
    norm_b = sum(x * x for x in b) ** 0.5
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def update_page_embeddings():
    pages = WikiPage.query.all()
    embeddings = _load_embeddings()

    for page in pages:
        text_to_embed = f"{page.title} {page.summary or ''} {page.body[:2000] if page.body else ''}"
        content_hash = hashlib.sha256(text_to_embed.encode('utf-8')).hexdigest()

        if page.slug in embeddings and embeddings[page.slug].get('hash') == content_hash:
            continue

        try:
            vector = compute_embedding(text_to_embed)
            embeddings[page.slug] = {
                'vector': vector,
                'hash': content_hash,
                'title': page.title,
            }
        except RuntimeError:
            continue

    slugs_in_db = {p.slug for p in pages}
    stale = [s for s in embeddings if s not in slugs_in_db]
    for s in stale:
        del embeddings[s]

    with _embeddings_lock:
        _save_embeddings(embeddings)

    return len(pages), len(stale)


def find_relevant_pages(question, top_k=5):
    embeddings = _load_embeddings()
    if not embeddings:
        return []

    try:
        question_vec = compute_embedding(question)
    except RuntimeError:
        return []

    scored = []
    for slug, data in embeddings.items():
        if 'vector' not in data:
            continue
        sim = _cosine_similarity(question_vec, data['vector'])
        scored.append((slug, data.get('title', slug), sim))

    scored.sort(key=lambda x: x[2], reverse=True)
    return [(slug, title, score) for slug, title, score in scored[:top_k]]


def bm25_keyword_score(question, pages_data):
    question_terms = set(question.lower().split())
    scored = []
    for page in pages_data:
        text = f"{page.get('title', '')} {page.get('summary', '')} {page.get('body', '')[:500]}".lower()
        page_terms = set(text.split())
        overlap = len(question_terms & page_terms)
        scored.append((page.get('slug', ''), page.get('title', ''), overlap))
    scored.sort(key=lambda x: x[2], reverse=True)
    return scored


def hybrid_search(question, top_k=5):
    vector_results = find_relevant_pages(question, top_k=top_k * 2)

    all_pages = WikiPage.query.all()
    pages_data = []
    for p in all_pages:
        pages_data.append({
            'slug': p.slug,
            'title': p.title,
            'summary': p.summary or '',
            'body': p.body or '',
        })
    keyword_results = bm25_keyword_score(question, pages_data)

    combined = {}
    for slug, title, score in vector_results:
        combined[slug] = combined.get(slug, 0) + score * 0.7
    max_kw = max((s for _, _, s in keyword_results), default=1) or 1
    for slug, title, score in keyword_results:
        normalized = score / max_kw
        combined[slug] = combined.get(slug, 0) + normalized * 0.3

    ranked = sorted(combined.items(), key=lambda x: x[1], reverse=True)

    slug_title_map = {p.slug: p.title for p in all_pages}
    return [(slug, slug_title_map.get(slug, slug), score) for slug, score in ranked[:top_k]]
