import subprocess
import tempfile
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field


class RenderRequest(BaseModel):
    html: str = Field(min_length=1)
    options: dict[str, Any] | None = None
    timeout_seconds: int = Field(default=30, ge=1, le=180)


app = FastAPI(title="wkhtmltopdf-service")


def _build_args(options: dict[str, Any] | None) -> list[str]:
    args: list[str] = ["wkhtmltopdf", "--disable-local-file-access"]
    if not options:
        return args

    for key, value in options.items():
        if not key:
            continue
        opt = f"--{key.strip()}"
        if isinstance(value, bool):
            if value:
                args.append(opt)
            continue
        args.extend([opt, str(value)])
    return args


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/render")
def render_pdf(payload: RenderRequest) -> Response:
    args = _build_args(payload.options)

    # wkhtmltopdf reads from an input HTML file and writes to output PDF file.
    with tempfile.NamedTemporaryFile(mode="w", suffix=".html", delete=False) as html_file:
        html_file.write(payload.html)
        input_path = html_file.name

    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as pdf_file:
        output_path = pdf_file.name

    try:
        cmd = args + [input_path, output_path]
        completed = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=payload.timeout_seconds,
            check=False,
        )
        if completed.returncode != 0:
            stderr = (completed.stderr or "").strip()
            raise HTTPException(
                status_code=400,
                detail=f"wkhtmltopdf failed: {stderr if stderr else 'unknown error'}",
            )

        with open(output_path, "rb") as f:
            pdf_bytes = f.read()

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": 'inline; filename="document.pdf"'},
        )
    except subprocess.TimeoutExpired as exc:
        raise HTTPException(status_code=504, detail="wkhtmltopdf timeout") from exc
    finally:
        for path in [input_path, output_path]:
            try:
                subprocess.run(["rm", "-f", path], check=False)
            except Exception:
                pass
