from flask import request, jsonify
from flask_login import login_required
from app.api import bp
from app.services.dashboard_service import DashboardService
from app.decorators import admin_required

@bp.route('/admin/dashboard', methods=['GET'])
@login_required
@admin_required
def get_dashboard():
    period = request.args.get('period', 'this_month')
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')
    
    data = DashboardService.get_main_dashboard_data(
        period=period, 
        start_date_arg=start_date, 
        end_date_arg=end_date
    )
    
    # Process data to be JSON serializable if needed (e.g. dates to strings)
    # The DashboardService seems to return mostly serializable data, 
    # but we should ensure dates are strings.
    
    # Basic date serialization check
    if 'dates' in data:
        data['dates']['start'] = data['dates']['start'].isoformat()
        data['dates']['end'] = data['dates']['end'].isoformat()
        
    if 'recent_activity' in data:
        for activity in data['recent_activity']:
            if 'time' in activity:
                activity['time'] = activity['time'].isoformat()
                
    if 'cohort' in data and 'top_debtors' in data['cohort']:
        for debtor in data['cohort']['top_debtors']:
            student = debtor['student']
            debtor['student'] = {
                "id": student.id,
                "username": student.username,
                "email": student.email
            }

    return jsonify(data), 200
