from flask import Blueprint, render_template

plan_bp = Blueprint('plan', __name__, template_folder='templates')

@plan_bp.route('/plan')
def plan():
    return render_template('plan.html', active_view='plan')
