import sys
import os

# Add the project root to the python path
sys.path.append(os.getcwd())

from app import create_app, db
from app.models import User, ROLE_ADMIN, Appointment, Enrollment, ClientComment, SetterDailyStats, CloserDailyStats
from werkzeug.security import generate_password_hash

app = create_app()

with app.app_context():
    print("Starting admin user reset process...")
    
    target_email = 'admin@admin.com'
    
    # 1. Ensure admin@admin.com exists first (so we have a target for reassignment)
    admin_user = User.query.filter_by(email=target_email).first()
    
    if not admin_user:
        print(f"Creating new user {target_email}...")
        admin_user = User(
            username='Super Admin',
            email=target_email,
            role=ROLE_ADMIN,
            is_active=True,
            timezone='America/La_Paz'
        )
        db.session.add(admin_user)
        db.session.commit() # Commit to get ID
    else:
        print(f"Found existing user {target_email} (ID: {admin_user.id})")
        admin_user.role = ROLE_ADMIN
        admin_user.is_active = True
        
    # Reset password
    admin_user.password_hash = generate_password_hash('administrator')
    db.session.commit()
    
    admin_id = admin_user.id
    print(f"Target Admin ID: {admin_id}")
    
    # 2. Find other admins to delete
    admins_to_delete = User.query.filter(User.role == ROLE_ADMIN, User.email != target_email).all()
    
    for user in admins_to_delete:
        print(f"Processing deletion for: {user.email} (ID: {user.id})")
        
        # A. Reassign critical records
        # Appointments
        appts = Appointment.query.filter_by(closer_id=user.id).all()
        for a in appts:
            a.closer_id = admin_id
        print(f"  - Reassigned {len(appts)} appointments")
        
        # Enrollments
        enr = Enrollment.query.filter_by(closer_id=user.id).all()
        for e in enr:
            e.closer_id = admin_id
        print(f"  - Reassigned {len(enr)} enrollments")
        
        # Comments
        comments = ClientComment.query.filter_by(author_id=user.id).all()
        for c in comments:
            c.author_id = admin_id
        print(f"  - Reassigned {len(comments)} comments")
        
        # B. Delete Stats (Avoid Unique Constraint collisions by just deleting)
        s_stats = SetterDailyStats.query.filter_by(setter_id=user.id).all()
        for s in s_stats:
            db.session.delete(s)
        print(f"  - Deleted {len(s_stats)} setter stats")
        
        c_stats = CloserDailyStats.query.filter_by(closer_id=user.id).all()
        for c in c_stats:
            db.session.delete(c)
        print(f"  - Deleted {len(c_stats)} closer stats")
        
        # C. Delete the user
        try:
            db.session.delete(user)
            db.session.commit() # Commit per user to isolate failures
            print(f"  - DELETED user {user.email}")
        except Exception as e:
            db.session.rollback()
            print(f"  - FAILED to delete {user.email}: {e}")
            # Fallback: Deactivate
            user.is_active = False
            user.role = 'archived'
            user.email = f"archived_{user.id}_{user.email}" # Clear up email for reuse
            user.username = f"archived_{user.id}_{user.username}"
            db.session.commit()
            print(f"  - ARCHIVED user {user.email} instead")

    print("---------------------------------------------------")
    print(f"SUCCESS: Admin user '{target_email}' is ready.")
    print("Password: administrator")
