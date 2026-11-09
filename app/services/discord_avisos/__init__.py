"""Los avisos a Discord, todos por un mismo servicio (ADR-W121).

  · envio.py: a dónde y cómo (webhook o bot, por canal), con la imagen o el embed de texto.
  · tarjeta.py: el aviso genérico (texto con nombre y número para buscar; el resto en la imagen).
  · venta.py: cada venta o cobro registrado (reemplaza al aviso que armaba n8n).
  · resultado.py: el resultado de cada llamada reportada.
  · externo.py: los que pide la Academia por la API (Onboarding, reactivación, tours, upsell).

Los avisos de agenda (app/agendas_v2/avisos_discord.py) mandan por envio.py con su propia tarjeta.
"""
