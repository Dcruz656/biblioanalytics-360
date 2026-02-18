import os
import json
from datetime import datetime
from typing import Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = ["https://www.googleapis.com/auth/spreadsheets.readonly"]


def get_sheets_service():
    creds_json = os.environ.get("GOOGLE_CREDENTIALS_JSON")
    if not creds_json:
        raise EnvironmentError(
            "La variable de entorno GOOGLE_CREDENTIALS_JSON no está configurada."
        )
    creds_dict = json.loads(creds_json)
    credentials = service_account.Credentials.from_service_account_info(
        creds_dict, scopes=SCOPES
    )
    service = build("sheets", "v4", credentials=credentials)
    return service


def fetch_sheet_data(spreadsheet_id: str, range_name: str = "A:Z") -> list[dict]:
    service = get_sheets_service()
    sheet = service.spreadsheets()

    result = sheet.values().get(
        spreadsheetId=spreadsheet_id,
        range=range_name
    ).execute()

    values = result.get("values", [])

    if not values or len(values) < 2:
        return []

    # Limpiar headers: quitar saltos de línea y espacios extra
    headers = [h.strip().replace("\n", " ") for h in values[0]]
    rows = values[1:]

    data = []
    for row in rows:
        row_padded = row + [None] * (len(headers) - len(row))
        data.append(dict(zip(headers, row_padded)))

    return data


def parse_uso_computadoras(raw_rows: list[dict]) -> list[dict]:
    parsed = []

    COLUMN_MAP = {
        "Marca temporal":                       "timestamp",
        "Biblioteca":                           "biblioteca",
        "Matrícula de cuenta del usuario":      "id_usuario",
        "Tipo de usuario":                      "tipo_usuario",
        "Hora de inicio":                       "hora_inicio",
        "Hora de fin":                          "hora_fin",
        "Propósito de uso":                     "proposito",
        "Número de equipo":                     "numero_equipo",
    }

    for row in raw_rows:
        mapped = {}
        for original_col, standard_col in COLUMN_MAP.items():
            mapped[standard_col] = row.get(original_col)

        mapped["duracion_minutos"] = _calc_duracion(
            mapped.get("hora_inicio"),
            mapped.get("hora_fin")
        )

        parsed.append(mapped)

    return parsed


def _calc_duracion(hora_inicio: Optional[str], hora_fin: Optional[str]) -> Optional[int]:
    if not hora_inicio or not hora_fin:
        return None
    try:
        fmt = "%H:%M"
        inicio = datetime.strptime(hora_inicio.strip(), fmt)
        fin = datetime.strptime(hora_fin.strip(), fmt)
        delta = (fin - inicio).seconds // 60
        return delta if delta >= 0 else None
    except (ValueError, AttributeError):
        return None
