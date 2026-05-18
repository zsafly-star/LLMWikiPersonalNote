import os
from dotenv import load_dotenv

load_dotenv()

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DEFAULT_RESOURCE_PATH = os.path.join(_PROJECT_ROOT, 'resource')


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key')
    SQLALCHEMY_DATABASE_URI = 'sqlite:///./sseditor.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    UPLOAD_FOLDER = 'static/uploads'
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024

    RESOURCE_BASE_PATH = os.getenv('RESOURCE_BASE_PATH', _DEFAULT_RESOURCE_PATH)
    ARTICLE_PATH = os.path.join(RESOURCE_BASE_PATH, 'article')
    IMAGE_PATH = os.path.join(RESOURCE_BASE_PATH, 'img')
    ATTACHMENT_PATH = os.path.join(RESOURCE_BASE_PATH, 'attachments')


class LLMConfig:
    SUPPORTED_MODELS = {
        'openai': ['gpt-4', 'gpt-3.5-turbo'],
        'claude': ['claude-3-sonnet', 'claude-3-haiku'],
        'gemini': ['gemini-pro'],
        'local': ['llama2-7b', 'qwen-7b']
    }
