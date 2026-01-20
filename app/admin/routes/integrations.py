from flask import render_template, redirect, url_for, flash, request
from app.admin import bp
from app.decorators import admin_required
from app.services.integration_service import IntegrationService

@bp.route('/integrations', methods=['GET', 'POST'])
@admin_required
def integrations():
    # Ensure defaults exist
    IntegrationService.ensure_defaults()
    
    if request.method == 'POST':
        key = request.form.get('key')
        data = {
            'url_dev': request.form.get('url_dev'),
            'url_prod': request.form.get('url_prod'),
            'active_env': request.form.get('active_env')
        }
        
        success, code = IntegrationService.update_integration(key, data)
        if success['success']:
            flash(success['message'])
        else:
            flash(success['message'], 'error')
        
        return redirect(url_for('admin.integrations'))
        
    # Fetch all
    integrations_list = IntegrationService.get_all()
    return render_template('admin/integrations.html', integrations=integrations_list)
