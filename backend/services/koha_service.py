import csv
import io
import re
from datetime import datetime


BIBLIOTECAS_VALIDAS = {"CEN", "CU", "DMNC", "IADA", "ICB", "ICSA", "IIT"}
ANIO_MIN = 2020
ANIO_MAX = datetime.now().year


def limpiar_texto(texto):
    """Corrige encoding mal interpretado y espacios extra."""
    if not texto:
        return None
    texto = texto.strip()
    # Corregir caracteres mal codificados comunes (latin-1 interpretado como utf-8)
    reemplazos = {
        "\u00c3\u00b3": "\u00f3",
        "\u00c3\u00a9": "\u00e9",
        "\u00c3\u00a1": "\u00e1",
        "\u00c3\u00ad": "\u00ed",
        "\u00c3\u00ba": "\u00fa",
        "\u00c3\u00b1": "\u00f1",
        "\u00c3\u2030": "\u00c9",
        "\u00c3\u2019": "\u00d3",
        "\u00c3\u0161": "\u00da",
        "\u00c3\u2018": "\u00d1",
        "\u00c2": "",
    }
    for mal, bien in reemplazos.items():
        texto = texto.replace(mal, bien)
    return texto.strip() or None


def normalizar_carrera(carrera):
    """Elimina espacios y estandariza variantes conocidas."""
    if not carrera:
        return None
    carrera = carrera.strip()
    variantes = {
        "sistemas": "Ingeniería en Sistemas",
        "ing. sistemas": "Ingeniería en Sistemas",
        "ingeniería en sistemas": "Ingeniería en Sistemas",
        " sistemas ": "Ingeniería en Sistemas",
    }
    return variantes.get(carrera.lower(), carrera)


def procesar_csv(contenido_bytes):
    """
    Procesa el CSV de Koha.
    Retorna un dict con:
    - registros_limpios: lista de dicts listos para insertar
    - reporte: resumen de inconsistencias encontradas
    - preview: primeros 20 registros para validación
    """
    reporte = {
        "total_filas": 0,
        "filas_validas": 0,
        "filas_descartadas": 0,
        "inconsistencias": [],
    }

    registros_limpios = []

    # Intentar decodificar con utf-8, luego latin-1
    try:
        texto = contenido_bytes.decode("utf-8-sig")
    except UnicodeDecodeError:
        texto = contenido_bytes.decode("latin-1")

    reader = csv.DictReader(io.StringIO(texto))

    for i, fila in enumerate(reader, start=2):  # start=2 porque fila 1 es header
        reporte["total_filas"] += 1
        errores_fila = []

        # --- Año ---
        try:
            anio = int(fila.get("Anio", "").strip())
            if not (ANIO_MIN <= anio <= ANIO_MAX):
                errores_fila.append(f"Año fuera de rango: {anio}")
                anio = None
        except ValueError:
            errores_fila.append(f"Año inválido: '{fila.get('Anio', '')}'")
            anio = None

        # --- Mes ---
        try:
            mes = int(fila.get("Mes", "").strip())
            if not (1 <= mes <= 12):
                errores_fila.append(f"Mes fuera de rango: {mes}")
                mes = None
        except ValueError:
            errores_fila.append(f"Mes inválido: '{fila.get('Mes', '')}'")
            mes = None

        # --- Biblioteca ---
        biblioteca_raw = fila.get("Biblioteca_Origen", "").strip().upper()
        if biblioteca_raw not in BIBLIOTECAS_VALIDAS:
            errores_fila.append(f"Biblioteca desconocida: '{biblioteca_raw}'")
            biblioteca = biblioteca_raw or None
        else:
            biblioteca = biblioteca_raw

        # --- Carrera ---
        carrera_raw = limpiar_texto(fila.get("Carrera_Programa", ""))
        carrera = normalizar_carrera(carrera_raw)
        if not carrera:
            errores_fila.append("Carrera vacía")

        # --- Título ---
        titulo = limpiar_texto(fila.get("Titulo_Libro", ""))
        if not titulo:
            errores_fila.append("Título vacío")

        # --- Total transacciones ---
        try:
            total = int(fila.get("Total_Transacciones", "").strip())
            if total < 0:
                errores_fila.append(f"Total negativo: {total}")
                total = None
        except ValueError:
            errores_fila.append(f"Total inválido: '{fila.get('Total_Transacciones', '')}'")
            total = None

        # --- Decisión ---
        if errores_fila:
            reporte["filas_descartadas"] += 1
            reporte["inconsistencias"].append({
                "fila": i,
                "errores": errores_fila,
                "datos_originales": {
                    "Anio": fila.get("Anio", ""),
                    "Mes": fila.get("Mes", ""),
                    "Biblioteca": fila.get("Biblioteca_Origen", ""),
                    "Carrera": fila.get("Carrera_Programa", ""),
                    "Titulo": fila.get("Titulo_Libro", "")[:60],
                    "Total": fila.get("Total_Transacciones", ""),
                },
            })
        else:
            reporte["filas_validas"] += 1
            registros_limpios.append({
                "anio": anio,
                "mes": mes,
                "biblioteca": biblioteca,
                "carrera": carrera,
                "titulo": titulo,
                "total_transacciones": total,
            })

    reporte["pct_calidad"] = round(
        (reporte["filas_validas"] / reporte["total_filas"] * 100), 1
    ) if reporte["total_filas"] > 0 else 0

    return {
        "registros_limpios": registros_limpios,
        "reporte": reporte,
        "preview": registros_limpios[:20],
    }