from flask import Flask
from flask_cors import CORS
from config import Config
from extensions import db
from common.llm_config import LLMProviderConfig
from modules.wiki.models import WikiPage
from modules.weather.models import WeatherConfig
from modules import (
    article_bp, chat_bp, folder_bp, picture_bp,
    home_bp, note_bp, todo_bp, plan_bp, settings_bp
)
app = Flask(__name__)
app.config.from_object(Config)

from modules.wiki import wiki_bp
from modules.weather import weather_bp

CORS(app)

db.init_app(app)

app.register_blueprint(home_bp)
app.register_blueprint(article_bp)
app.register_blueprint(picture_bp)
app.register_blueprint(chat_bp)
app.register_blueprint(folder_bp)
app.register_blueprint(note_bp)
app.register_blueprint(todo_bp)
app.register_blueprint(plan_bp)
app.register_blueprint(settings_bp)
app.register_blueprint(wiki_bp)
app.register_blueprint(weather_bp)

@app.route('/api')
def api_index():
    return {
        'name': 'SSEditor',
        'version': '1.0.0',
        'description': '个人知识管理系统',
        'api': '/api'
    }

with app.app_context():
    import os
    # 自动创建必要的目录
    directories = [
        app.config['ARTICLE_PATH'],
        app.config['IMAGE_PATH'],
        app.config['ATTACHMENT_PATH'],
        app.config['WIKI_PATH'],
        app.config['INSTANCE_PATH']
    ]
    for directory in directories:
        if not os.path.exists(directory):
            os.makedirs(directory)
            print(f"Created directory: {directory}")
    
    db.create_all()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
