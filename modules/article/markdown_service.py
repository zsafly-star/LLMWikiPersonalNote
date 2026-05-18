import re
import markdown as md_lib

MARKDOWN_EXTENSIONS = [
    'markdown.extensions.extra',
    'markdown.extensions.codehilite',
    'markdown.extensions.toc',
    'markdown.extensions.tables',
]


def render_markdown(content):
    return md_lib.markdown(content, extensions=MARKDOWN_EXTENSIONS)


def rewrite_image_links(content, api_prefix):
    content = re.sub(
        r'(!\[[^\]]*\]\()\s*\.?/?img/',
        r'\1' + re.escape(api_prefix),
        content
    )
    content = re.sub(
        r'(!\[[^\]]*\]\()\s*(?!(?:https?://|/api/))([^\s\)]+\.(?:png|jpe?g|gif|bmp|webp|svg))',
        r'\1' + re.escape(api_prefix) + r'\2',
        content
    )
    return content


def build_image_api_prefix(image_path):
    return '/api/article/image?image_path=' + image_path + '&img='
