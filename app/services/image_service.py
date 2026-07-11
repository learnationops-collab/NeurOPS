from PIL import Image, ImageDraw, ImageFont
import io

class ImageService:
    @staticmethod
    def generate_client_card(data):
        """
        Generates a premium 'Client Card' image for Discord notifications.
        Delegated to ReportImageService.
        """
        from app.services.report_image_service import ReportImageService
        return ReportImageService.generate_client_card(data)

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
        Delegated to ReportImageService.
        """
        from app.services.report_image_service import ReportImageService
        return ReportImageService.generate_setter_report_card(data)

    @staticmethod
    def generate_closer_report_card(data):
        """
        Delegated to ReportImageService.
        """
        from app.services.report_image_service import ReportImageService
        return ReportImageService.generate_closer_report_card(data)

    @staticmethod
    def generate_triage_report_card(data):
        """
        Delegated to ReportImageService.
        """
        from app.services.report_image_service import ReportImageService
        return ReportImageService.generate_triage_report_card(data)

    @staticmethod
    def generate_triage_tracker_card(data):
        """
        Delegated to ReportImageService.
        """
        from app.services.report_image_service import ReportImageService
        return ReportImageService.generate_triage_tracker_card(data)

    @staticmethod
    def generate_reflection_card(data):
        """
        Delegated to ReportImageService.
        """
        from app.services.report_image_service import ReportImageService
        return ReportImageService.generate_reflection_card(data)
