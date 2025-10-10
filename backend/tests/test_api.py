# backend/tests/test_api.py
import os
import importlib.util
import json
from pathlib import Path

def load_app_module(db_path: str):
    """
    Load backend/app.py as an importable module using importlib,
    set DATABASE_URL to an sqlite file, init DB and return module.
    """
    # ensure DB env var is set BEFORE calling init_db()
    os.environ['DATABASE_URL'] = f"sqlite:///{db_path}"
    app_path = Path(__file__).resolve().parent.parent / "app.py"
    spec = importlib.util.spec_from_file_location("can_app", str(app_path))
    can_app = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(can_app)
    
    if hasattr(can_app, "init_db"):
        can_app.init_db()
    return can_app

def test_crud_endpoints(tmp_path):
    dbfile = tmp_path / "test_responses.db"
    app_mod = load_app_module(str(dbfile))
    client = app_mod.app.test_client()

    # Create 
    create_resp = client.post(
        "/api/responses",
        json={"title": "Test Title", "content": "Test content", "tags": ["x", "y"]},
    )
    assert create_resp.status_code == 201, create_resp.get_data(as_text=True)
    data = create_resp.get_json()
    assert "id" in data
    rid = data["id"]

    # GET ALL
    list_resp = client.get("/api/responses")
    assert list_resp.status_code == 200
    arr = list_resp.get_json()
    assert isinstance(arr, list)
    assert any(item["id"] == rid for item in arr)

    # GET SINGLE
    single = client.get(f"/api/responses/{rid}")
    assert single.status_code == 200
    sdata = single.get_json()
    assert sdata["title"] == "Test Title"

    # UPDATE
    upd = client.put(f"/api/responses/{rid}", json={"title": "Updated Title"})
    assert upd.status_code == 200
    udata = upd.get_json()
    assert udata["title"] == "Updated Title"

    # DELETE
    d = client.delete(f"/api/responses/{rid}")
    assert d.status_code == 204
