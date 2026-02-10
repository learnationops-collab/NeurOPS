from PIL import Image, ImageDraw, ImageFont
import io

class ImageService:
    @staticmethod
    def generate_client_card(data):
        """
        Generates a premium 'Client Card' image.
        """
        # Configuration
        width, height = 800, 400
        
        # Colors (Dark Theme)
        bg_color = (20, 23, 30)        # Deep dark background
        card_color = (30, 35, 45)      # Card surface
        accent_color = (87, 242, 135)  # Neon Green (Discord-ish)
        text_white = (255, 255, 255)
        text_gray = (160, 170, 180)
        divider_color = (50, 55, 70)
        
        # Create Canvas
        img = Image.new('RGB', (width, height), bg_color)
        draw = ImageDraw.Draw(img)
        
        # Draw "Card" Surface (Simulated with rectangle)
        margin = 25
        draw.rectangle([margin, margin, width-margin, height-margin], fill=card_color)
        
        # Accent Bar (Left)
        draw.rectangle([margin, margin, margin + 8, height-margin], fill=accent_color)
        
        # Load Fonts
        # Attempt to load Arial or similar system fonts for better look
        try:
            # Windows/Linux common paths might vary, 'arial.ttf' often works on Windows
            font_title = ImageFont.truetype("arialbd.ttf", 32)
            font_name = ImageFont.truetype("arialbd.ttf", 56)
            font_label = ImageFont.truetype("arial.ttf", 18)
            font_value = ImageFont.truetype("arial.ttf", 28)
            font_count = ImageFont.truetype("arialbd.ttf", 100)
        except OSError:
            # Fallback
            font_title = ImageFont.load_default()
            font_name = ImageFont.load_default()
            font_label = ImageFont.load_default()
            font_value = ImageFont.load_default()
            font_count = ImageFont.load_default()

        # Layout Coordinates
        content_x = margin + 50
        current_y = margin + 40
        
        # 1. Header Title
        draw.text((content_x, current_y), "NUEVA AGENDA", font=font_title, fill=accent_color)
        current_y += 50
        
        # 2. Client Name
        client_name = data.get('client_name', 'Cliente').upper()
        # Truncate if too long
        if len(client_name) > 25:
            client_name = client_name[:22] + "..."
        draw.text((content_x, current_y), client_name, font=font_name, fill=text_white)
        current_y += 80
        
        # 3. Divider Line
        draw.line([content_x, current_y, width - margin - 40, current_y], fill=divider_color, width=2)
        current_y += 35
        
        # 4. Details Grid
        # Row 1
        # Col A: Closer
        draw.text((content_x, current_y), "CLOSER ASIGNADO", font=font_label, fill=text_gray)
        draw.text((content_x, current_y + 25), data.get('closer_name', 'N/A'), font=font_value, fill=text_white)
        
        # Col B: Date & Time (Offset by 300px)
        col_b_x = content_x + 300
        draw.text((col_b_x, current_y), "FECHA Y HORA", font=font_label, fill=text_gray)
        date_time = f"{data.get('date_str', '')} - {data.get('time_str', '')}"
        draw.text((col_b_x, current_y + 25), date_time, font=font_value, fill=text_white)
        
        # Watermark / Count (Right Side)
        count_val = str(data.get('count', '0'))
        
        # Draw large count number in background/corner
        bbox = draw.textbbox((0, 0), count_val, font=font_count)
        num_w = bbox[2] - bbox[0]
        
        right_align_x = width - margin - num_w - 40
        top_align_y = margin + 30
        
        draw.text((right_align_x, top_align_y), count_val, font=font_count, fill=(45, 50, 65)) # Subtle contrast
        
        draw.text((right_align_x + num_w - 50, top_align_y + 110), "HOY", font=font_label, fill=(45, 50, 65))

        # Save
        buf = io.BytesIO()
        img.save(buf, format='PNG')
        buf.seek(0)
        return buf
