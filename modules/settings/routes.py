from flask import Blueprint, request, render_template
from common.response import success_response, error_response
from common.llm import LLMService
from common.llm_config import LLMConfigService

settings_bp = Blueprint('settings', __name__, template_folder='templates')


@settings_bp.route('/settings')
def settings():
    return render_template('settings.html', active_view='settings')


@settings_bp.route('/api/llm/providers', methods=['GET'])
def get_providers():
    providers = LLMService.get_provider_list()
    models = LLMService.get_all_models()
    return success_response({
        'providers': providers,
        'models': models
    })


@settings_bp.route('/api/llm/configs', methods=['GET'])
def get_llm_configs():
    configs = LLMConfigService.get_all()
    return success_response(configs)


@settings_bp.route('/api/llm/configs', methods=['POST'])
def create_llm_config():
    data = request.get_json()
    if not data or 'provider' not in data:
        return error_response('缺少 provider')

    config = LLMConfigService.create(data)
    return success_response(config, '创建成功')


@settings_bp.route('/api/llm/configs/<int:config_id>', methods=['PUT'])
def update_llm_config(config_id):
    data = request.get_json()
    config = LLMConfigService.update(config_id, data)
    if config:
        return success_response(config, '更新成功')
    return error_response('配置不存在', 404)


@settings_bp.route('/api/llm/configs/<int:config_id>', methods=['DELETE'])
def delete_llm_config(config_id):
    success = LLMConfigService.delete(config_id)
    if success:
        return success_response(None, '删除成功')
    return error_response('配置不存在', 404)


@settings_bp.route('/api/llm/configs/<int:config_id>/test', methods=['POST'])
def test_llm_config(config_id):
    result = LLMConfigService.test_connection(config_id)
    if result['success']:
        return success_response(result)
    return error_response(result['message'])
