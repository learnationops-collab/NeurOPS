from flask import Blueprint, render_template, redirect, url_for
from flask_login import current_user

main = Blueprint('main', __name__)

@main.route('/')
def index():
    if current_user.is_authenticated:
        if current_user.role == 'admin':
            return redirect(url_for('admin.dashboard'))
        elif current_user.role == 'closer':
            return redirect(url_for('closer.dashboard'))
        else:
            return render_template('student_access.html')
    return redirect(url_for('auth.login'))
