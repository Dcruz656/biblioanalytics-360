import os
from fastapi import APIRouter, HTTPException, Query
from services.sheets_service import fetch_sheet_data, parse_uso_computadoras

router = APIRouter()


@router.get("/uso-computadoras")
def get_uso_computadoras(
    spreadsheet_id: str = Query(
        default=None,
        description="ID del Google Sheet. Si no se pasa, usa la variable de entorno SHEET_USO_COMPUTADORAS."
    ),
    raw: bool = Query(default=False, description="Si true, retorna filas crudas sin mapear.")
):
    """
    Lee el formulario de uso de computadoras desde Google Sheets
    y retorna los datos procesados.
    """
    sheet_id = spreadsheet_id or os.environ.get("SHEET_USO_COMPUTADORAS")
    if not sheet_id:
        raise HTTPException(
            status_code=400,
            detail="Debes pasar spreadsheet_id como query param o configurar SHEET_USO_COMPUTADORAS en variables de entorno."
        )

    try:
        raw_data = fetch_sheet_data(sheet_id)
    except EnvironmentError as e:
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al leer Google Sheets: {str(e)}")

    if raw:
        return {"total": len(raw_data), "data": raw_data}

    parsed = parse_uso_computadoras(raw_data)
    return {"total": len(parsed), "data": parsed}


@router.get("/uso-computadoras/stats")
def get_stats_uso_computadoras(
    spreadsheet_id: str = Query(default=None)
):
    """
    Retorna estadísticas agregadas del uso de computadoras:
    - Total de sesiones
    - Duración promedio
    - Desglose por tipo de usuario
    - Desglose por propósito
    - Desglose por biblioteca
    """
    sheet_id = spreadsheet_id or os.environ.get("SHEET_USO_COMPUTADORAS")
    if not sheet_id:
        raise HTTPException(status_code=400, detail="spreadsheet_id requerido.")

    try:
        raw_data = fetch_sheet_data(sheet_id)
        data = parse_uso_computadoras(raw_data)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

    if not data:
        return {"total_sesiones": 0, "stats": {}}

    # Duración promedio
    duraciones = [r["duracion_minutos"] for r in data if r.get("duracion_minutos") is not None]
    promedio_duracion = round(sum(duraciones) / len(duraciones), 1) if duraciones else None

    # Agrupar por campo
    def agrupar(campo: str) -> dict:
        resultado = {}
        for row in data:
            val = row.get(campo) or "Sin especificar"
            resultado[val] = resultado.get(val, 0) + 1
        return resultado

    return {
        "total_sesiones": len(data),
        "duracion_promedio_minutos": promedio_duracion,
        "por_tipo_usuario": agrupar("tipo_usuario"),
        "por_proposito": agrupar("proposito"),
        "por_biblioteca": agrupar("biblioteca"),
    }
