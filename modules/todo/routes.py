from flask import Blueprint, render_template

todo_bp = Blueprint('todo', __name__, template_folder='templates')

@todo_bp.route('/todo')
def todo():
    return render_template('todo.html', active_view='todo')
