import os
import io
import uuid
from flask import render_template_string
from html2image import Html2Image

class ReportImageService:
    @staticmethod
    def _get_hti(size):
        """
        Helper para configurar e inicializar Html2Image de forma robusta.
        """
        custom_flags = []
        browser_executable = None
        output_path = None
        temp_path = None
        
        if os.name != 'nt':  # Entorno Docker/Linux (produccion)
            custom_flags = [
                '--no-sandbox', 
                '--disable-setuid-sandbox', 
                '--disable-dev-shm-usage', 
                '--headless=new', 
                '--disable-gpu',
                '--disable-software-rasterizer',
                '--disable-dbus', 
                '--disable-extensions',
                '--log-level=3'
            ]
            # Rutas comunes para chromium en debian/ubuntu
            for path in ['/usr/bin/chromium', '/usr/bin/chromium-browser']:
                if os.path.exists(path):
                    browser_executable = path
                    break
            # Forzar uso de /tmp para permisos en Docker
            output_path = '/tmp'
            temp_path = '/tmp'
            
        return Html2Image(
            size=size, 
            custom_flags=custom_flags,
            browser_executable=browser_executable,
            output_path=output_path,
            temp_path=temp_path
        )

    @staticmethod
    def _render_and_capture(template_rel_path, data, size, output_prefix):
        """
        Helper generico para leer plantilla, renderizar HTML, tomar captura y retornar buffer.
        """
        template_path = os.path.join('app', *template_rel_path.split('/'))
        with open(template_path, 'r', encoding='utf-8') as f:
            template_content = f.read()

        rendered_html = render_template_string(template_content, **data)
        output_filename = f"{output_prefix}_{uuid.uuid4().hex}.png"
        
        hti = ReportImageService._get_hti(size)
        
        try:
            paths = hti.screenshot(html_str=rendered_html, save_as=output_filename)
            if not paths:
                raise Exception(f"html2image no pudo crear la captura para {output_prefix}")
            
            final_path = paths[0]
            with open(final_path, 'rb') as img_f:
                buf = io.BytesIO(img_f.read())
            
            if os.path.exists(final_path):
                os.remove(final_path)
                
            buf.seek(0)
            return buf
        except Exception as e:
            print(f"[ReportImageService {output_prefix} Error] {e}")
            raise e

    @staticmethod
    def generate_client_card(data):
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
        return ReportImageService._render_and_capture(
            'templates/reports/agenda_report.html',
            render_data,
            (800, 600),
            'agenda'
        )

    @staticmethod
    def generate_setter_report_card(data):
        return ReportImageService._render_and_capture(
            'templates/reports/setter_report.html',
            data,
            (1200, 1800),
            'report'
        )

    @staticmethod
    def generate_closer_report_card(data):
        return ReportImageService._render_and_capture(
            'templates/reports/closer_report.html',
            data,
            (1200, 2600),
            'closer_report'
        )

    @staticmethod
    def generate_triage_report_card(data):
        return ReportImageService._render_and_capture(
            'templates/reports/triage_report.html',
            data,
            (1000, 1200),
            'triage_report'
        )

    @staticmethod
    def generate_triage_tracker_card(data):
        return ReportImageService._render_and_capture(
            'templates/reports/triage_tracker_report.html',
            data,
            (1200, 1800),
            'triage_tracker'
        )

    @staticmethod
    def generate_reflection_card(data):
        return ReportImageService._render_and_capture(
            'templates/reports/reflection_image.html',
            data,
            (1200, 1400),
            'reflection'
        )
