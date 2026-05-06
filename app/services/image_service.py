from PIL import Image, ImageDraw, ImageFont
import io

class ImageService:
    @staticmethod
    def generate_client_card(data):
        """
        Generates a premium 'Client Card' image for Discord notifications using HTML rendering.
        """
        import os
        from flask import render_template_string
        from html2image import Html2Image
        import io
        import uuid
        
        # 1. Read the template
        template_path = os.path.join('app', 'templates', 'reports', 'agenda_report.html')
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        # 2. Render HTML with Data
        # Note: We provide default fallback values for template variables
        render_data = {
            "client_name": data.get('client_name', 'CLIENTE').upper(),
            "closer_name": data.get('closer_name', 'N/A'),
            "date_str": data.get('date_str', ''),
            "time_str": data.get('time_str', ''),
            "lead_source": data.get('source', 'DESCONOCIDO').upper(),
            "client_phone": data.get('client_phone', 'N/A'),
            "client_ig": data.get('client_ig', 'N/A'),
            "count": data.get('count', '0')
        }
        rendered_html = render_template_string(template_content, **render_data)

        # 3. Configure html2image
        output_filename = f"agenda_{uuid.uuid4().hex}.png"
        
        # Docker/Linux compatibility
        custom_flags = []
        browser_executable = None
        if os.name != 'nt':
            custom_flags = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless']
            for path in ['/usr/bin/chromium', '/usr/bin/chromium-browser']:
                if os.path.exists(path):
                    browser_executable = path
                    break

        hti = Html2Image(
            size=(800, 600), 
            custom_flags=custom_flags,
            browser_executable=browser_executable
        ) 
        
        try:
            paths = hti.screenshot(html_str=rendered_html, save_as=output_filename)
            if not paths:
                raise Exception("html2image failed to create screenshot for agenda")
            
            final_path = paths[0]
            with open(final_path, 'rb') as img_f:
                buf = io.BytesIO(img_f.read())
            
            if os.path.exists(final_path):
                os.remove(final_path)
                
            buf.seek(0)
            return buf
            
        except Exception as e:
            print(f"[ImageService Agenda Error] {e}")
            # Fallback to a simple PIL version or re-raise
            raise e

    @staticmethod
    def generate_sale_card(data):
        """
        Generates a premium 'Sale Card' (WON) image for Discord notifications.
        Theme: Gold / Victory / Premium
        """
        # Configuration
        width, height = 800, 480
        
        # Colors (Sale/Gold Theme)
        bg_color = (13, 17, 23)
        card_color = (22, 27, 34)
        accent_color = (255, 215, 0)    # Gold accent
        text_white = (240, 246, 252)
        text_gray = (139, 148, 158)
        divider_color = (48, 54, 61)
        
        # Create Canvas
        img = Image.new('RGB', (width, height), bg_color)
        draw = ImageDraw.Draw(img)
        
        # Draw "Card" Surface
        margin = 20
        draw.rounded_rectangle([margin, margin, width-margin, height-margin], radius=24, fill=card_color)
        
        # Accent Bar (Top ribbon style)
        draw.rounded_rectangle([margin+40, margin, margin + 200, margin + 4], radius=2, fill=accent_color)
        
        # Load Fonts
        try:
            font_title = ImageFont.truetype("arialbd.ttf", 26)
            font_name = ImageFont.truetype("arialbd.ttf", 52)
            font_label = ImageFont.truetype("arial.ttf", 16)
            font_value = ImageFont.truetype("arialbd.ttf", 28)
            font_count = ImageFont.truetype("arialbd.ttf", 120)
        except OSError:
            font_title = ImageFont.load_default()
            font_name = ImageFont.load_default()
            font_label = ImageFont.load_default()
            font_value = ImageFont.load_default()
            font_count = ImageFont.load_default()

        # Layout
        content_x = margin + 50
        current_y = margin + 50
        
        # 1. Header Title
        draw.text((content_x, current_y), "🚀 ¡NUEVA VENTA CERRADA!", font=font_title, fill=accent_color)
        current_y += 45
        
        # 2. Client Name
        client_name = data.get('client_name', 'CLIENTE').upper()
        if len(client_name) > 22:
            client_name = client_name[:19] + "..."
        draw.text((content_x, current_y), client_name, font=font_name, fill=text_white)
        current_y += 85
        
        # 3. Divider Line
        draw.line([content_x, current_y, width - margin - 50, current_y], fill=divider_color, width=1)
        current_y += 35
        
        # 4. Info Grid (Columns)
        # Col 1: Details
        draw.text((content_x, current_y), "CLOSER (THE KING)", font=font_label, fill=text_gray)
        draw.text((content_x, current_y + 22), data.get('closer_name', 'N/A'), font=font_value, fill=accent_color)
        
        current_y += 75
        draw.text((content_x, current_y), "PROGRAMA", font=font_label, fill=text_gray)
        draw.text((content_x, current_y + 22), data.get('program_name', 'N/A'), font=font_value, fill=text_white)
        
        current_y += 75
        draw.text((content_x, current_y), "TIPO DE PAGO", font=font_label, fill=text_gray)
        draw.text((content_x, current_y + 22), data.get('payment_type', 'N/A'), font=font_value, fill=text_white)

        # Col 2: High Priority Info
        col_b_x = content_x + 320
        col_b_y = margin + 180
        draw.text((col_b_x, col_b_y), "MONTO RECAUDADO", font=font_label, fill=text_gray)
        amount_str = f"${data.get('amount', '0.0')}"
        draw.text((col_b_x, col_b_y + 22), amount_str, font=font_name, fill=accent_color)
        
        col_b_y += 110
        draw.text((col_b_x, col_b_y), "MÉTODO", font=font_label, fill=text_gray)
        draw.text((col_b_x, col_b_y + 22), data.get('payment_method', 'N/A').upper(), font=font_value, fill=text_white)

        # 5. Count Badge
        count_val = str(data.get('count', '1'))
        bbox = draw.textbbox((0, 0), count_val, font=font_count)
        num_w = bbox[2] - bbox[0]
        watermark_x = width - margin - num_w - 50
        watermark_y = margin + 30
        
        draw.text((watermark_x, watermark_y), count_val, font=font_count, fill=(45, 40, 30)) 
        draw.text((watermark_x + num_w - 60, watermark_y + 115), "Ventas", font=font_label, fill=(139, 148, 158))

        # Save
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return buf

    @staticmethod
    def generate_setter_report_card(data):
        """
        Generates a high-fidelity 'Premium Dashboard' report using HTML/CSS rendering.
        """
        import os
        from flask import render_template_string
        from html2image import Html2Image
        import io
        import uuid
        
        # 1. Read the template
        template_path = os.path.join('app', 'templates', 'reports', 'setter_report.html')
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        # 2. Render HTML with Data using Flask's render_template_string (Jinja2)
        # Note: We use render_template_string to be safe if the file isn't in the global template search path
        rendered_html = render_template_string(template_content, **data)

        # 3. Configure html2image
        # We output to a temp file then read it back to match the buffer return type
        output_filename = f"report_{uuid.uuid4().hex}.png"
        
        # Determine if we are in Docker/Linux to set correct flags
        custom_flags = []
        browser_executable = None
        
        if os.name != 'nt': # Not Windows
            custom_flags = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless', '--disable-dbus', '--disable-extensions']
            # Common paths for chromium in linux
            for path in ['/usr/bin/chromium', '/usr/bin/chromium-browser']:
                if os.path.exists(path):
                    browser_executable = path
                    break

        hti = Html2Image(
            size=(1200, 1800), 
            custom_flags=custom_flags,
            browser_executable=browser_executable
        ) 
        
        try:
            # Render to image
            # html2image screenshot returns a list of file paths
            paths = hti.screenshot(html_str=rendered_html, save_as=output_filename)
            
            if not paths:
                raise Exception("html2image failed to create screenshot")
            
            final_path = paths[0]
            
            # 4. Read into buffer
            with open(final_path, 'rb') as img_f:
                buf = io.BytesIO(img_f.read())
            
            # Cleanup temp file
            if os.path.exists(final_path):
                os.remove(final_path)
                
            buf.seek(0)
            return buf
            
        except Exception as e:
            print(f"[ImageService Error] {e}")
            import traceback
            traceback.print_exc()
            # If rendering fails, Fallback to a super simple PIL or just re-raise
            raise e

    @staticmethod
    def generate_closer_report_card(data):
        """
        Generates a high-fidelity 'Premium Dashboard' report for Closers using HTML/CSS rendering.
        """
        import os
        from flask import render_template_string
        from html2image import Html2Image
        import io
        import uuid
        
        # 1. Read the template
        template_path = os.path.join('app', 'templates', 'reports', 'closer_report.html')
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        # 2. Render HTML with Data using Flask's render_template_string (Jinja2)
        rendered_html = render_template_string(template_content, **data)

        # 3. Configure html2image
        output_filename = f"closer_report_{uuid.uuid4().hex}.png"
        
        custom_flags = []
        browser_executable = None
        
        if os.name != 'nt': # Not Windows
            custom_flags = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless', '--disable-dbus', '--disable-extensions']
            for path in ['/usr/bin/chromium', '/usr/bin/chromium-browser']:
                if os.path.exists(path):
                    browser_executable = path
                    break

        hti = Html2Image(
            size=(1200, 2600), # Increased height to accommodate reflections
            custom_flags=custom_flags,
            browser_executable=browser_executable
        ) 
        
        try:
            paths = hti.screenshot(html_str=rendered_html, save_as=output_filename)
            
            if not paths:
                raise Exception("html2image failed to create screenshot")
            
            final_path = paths[0]
            
            # 4. Read into buffer
            with open(final_path, 'rb') as img_f:
                buf = io.BytesIO(img_f.read())
            
            # Cleanup temp file
            if os.path.exists(final_path):
                os.remove(final_path)
                
            buf.seek(0)
            return buf
            
        except Exception as e:
            print(f"[ImageService Error] {e}")
            import traceback
            traceback.print_exc()
            raise e
    @staticmethod
    def generate_triage_report_card(data):
        """
        Generates a premium 'Triage Report' image for Discord notifications.
        """
        import os
        from flask import render_template_string
        from html2image import Html2Image
        import io
        import uuid
        
        # 1. Read the template
        template_path = os.path.join('app', 'templates', 'reports', 'triage_report.html')
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        # 2. Render HTML with Data
        rendered_html = render_template_string(template_content, **data)

        # 3. Configure html2image
        output_filename = f"triage_report_{uuid.uuid4().hex}.png"
        
        custom_flags = []
        browser_executable = None
        if os.name != 'nt':
            custom_flags = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless', '--disable-dbus', '--disable-extensions']
            for path in ['/usr/bin/chromium', '/usr/bin/chromium-browser']:
                if os.path.exists(path):
                    browser_executable = path
                    break

        hti = Html2Image(
            size=(1000, 1200), 
            custom_flags=custom_flags,
            browser_executable=browser_executable
        ) 
        
        try:
            paths = hti.screenshot(html_str=rendered_html, save_as=output_filename)
            if not paths:
                raise Exception("html2image failed to create screenshot for triage")
            
            final_path = paths[0]
            with open(final_path, 'rb') as img_f:
                buf = io.BytesIO(img_f.read())
            
            if os.path.exists(final_path):
                os.remove(final_path)
                
            buf.seek(0)
            return buf
            
        except Exception as e:
            print(f"[ImageService Triage Error] {e}")
            raise e

    @staticmethod
    def generate_triage_tracker_card(data):
        """
        Generates a premium 'Triage Tracker Report' image for Discord notifications.
        """
        import os
        from flask import render_template_string
        from html2image import Html2Image
        import io
        import uuid
        
        template_path = os.path.join('app', 'templates', 'reports', 'triage_tracker_report.html')
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        rendered_html = render_template_string(template_content, **data)

        output_filename = f"triage_tracker_{uuid.uuid4().hex}.png"
        
        custom_flags = []
        browser_executable = None
        if os.name != 'nt':
            custom_flags = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless', '--disable-dbus', '--disable-extensions']
            for path in ['/usr/bin/chromium', '/usr/bin/chromium-browser']:
                if os.path.exists(path):
                    browser_executable = path
                    break

        hti = Html2Image(
            size=(1200, 1800), 
            custom_flags=custom_flags,
            browser_executable=browser_executable
        ) 
        
        try:
            paths = hti.screenshot(html_str=rendered_html, save_as=output_filename)
            if not paths:
                raise Exception("html2image failed to create screenshot for triage tracker")
            
            final_path = paths[0]
            with open(final_path, 'rb') as img_f:
                buf = io.BytesIO(img_f.read())
            
            if os.path.exists(final_path):
                os.remove(final_path)
                
            buf.seek(0)
            return buf
            
        except Exception as e:
            print(f"[ImageService Triage Tracker Error] {e}")
            raise e

    @staticmethod
    def generate_reflection_card(data):
        """
        Generates a premium 'Daily Reflection' image for Discord notifications.
        """
        import os
        from flask import render_template_string
        from html2image import Html2Image
        import io
        import uuid
        
        template_path = os.path.join('app', 'templates', 'reports', 'reflection_image.html')
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        rendered_html = render_template_string(template_content, **data)
        output_filename = f"reflection_{uuid.uuid4().hex}.png"
        
        custom_flags = []
        browser_executable = None
        if os.name != 'nt':
            custom_flags = ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--headless', '--disable-dbus', '--disable-extensions']
            for path in ['/usr/bin/chromium', '/usr/bin/chromium-browser']:
                if os.path.exists(path):
                    browser_executable = path
                    break

        hti = Html2Image(
            size=(1200, 1000), 
            custom_flags=custom_flags,
            browser_executable=browser_executable
        ) 
        
        try:
            paths = hti.screenshot(html_str=rendered_html, save_as=output_filename)
            if not paths:
                raise Exception("html2image failed to create screenshot for reflection")
            
            final_path = paths[0]
            with open(final_path, 'rb') as img_f:
                buf = io.BytesIO(img_f.read())
            
            if os.path.exists(final_path):
                os.remove(final_path)
                
            buf.seek(0)
            return buf
            
        except Exception as e:
            print(f"[ImageService Reflection Error] {e}")
            raise e
