from fastapi import APIRouter, UploadFile, File, HTTPException
from sqlalchemy import text
from database import engine
from services.koha_service import procesar_csv

router = APIRouter(prefix="/api/v1/koha", tags=["koha"])

# Almacenamiento temporal en memoria (válido por sesión del servidor)
_pending_data = {}


@router.post("/upload")
async def upload_koha(file: UploadFile = File(...)):
    """
    Recibe el CSV de Koha, lo limpia y devuelve reporte de calidad + preview.
    Los datos limpios quedan en memoria pendientes de confirmación.
    """
    if not file.filename.endswith((".csv", ".CSV")):
        raise HTTPException(status_code=400, detail="Solo se aceptan archivos CSV")

    contenido = await file.read()
    resultado = procesar_csv(contenido)

    # Guardar en memoria para confirmar después
    _pending_data["koha"] = resultado["registros_limpios"]

    return {
        "archivo": file.filename,
        "reporte": resultado["reporte"],
        "preview": resultado["preview"],
    }


@router.post("/confirmar")
def confirmar_ingesta():
    """
    Inserta los registros limpios pendientes en Neon DB.
    """
    registros = _pending_data.get("koha")
    if not registros:
        raise HTTPException(status_code=400, detail="No hay datos pendientes de confirmación")

    insertados = 0
    with engine.connect() as conn:
        for r in registros:
            conn.execute(text("""
                INSERT INTO koha_prestamos (anio, mes, biblioteca, carrera, titulo, total_transacciones)
                VALUES (:anio, :mes, :biblioteca, :carrera, :titulo, :total_transacciones)
            """), r)
            insertados += 1
        conn.commit()

    _pending_data.pop("koha", None)

    return {
        "status": "ok",
        "registros_insertados": insertados,
        "mensaje": f"{insertados} registros insertados correctamente en la base de datos."
    }


@router.get("/stats")
def stats_koha():
    """
    Estadísticas agregadas de préstamos desde Neon DB.
    """
    with engine.connect() as conn:
        total = conn.execute(text("SELECT COUNT(*) FROM koha_prestamos")).scalar()
        por_biblioteca = conn.execute(text("""
            SELECT biblioteca, SUM(total_transacciones) as total
            FROM koha_prestamos GROUP BY biblioteca ORDER BY total DESC
        """)).fetchall()
        por_anio = conn.execute(text("""
            SELECT anio, SUM(total_transacciones) as total
            FROM koha_prestamos GROUP BY anio ORDER BY anio
        """)).fetchall()
        top_titulos = conn.execute(text("""
            SELECT titulo, SUM(total_transacciones) as total
            FROM koha_prestamos GROUP BY titulo ORDER BY total DESC LIMIT 10
        """)).fetchall()

    return {
        "total_registros": total,
        "por_biblioteca": {r.biblioteca: r.total for r in por_biblioteca},
        "por_anio": {str(r.anio): r.total for r in por_anio},
        "top_titulos": [{"titulo": r.titulo, "total": r.total} for r in top_titulos],
    }