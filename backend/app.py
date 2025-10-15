from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
import json
import os
import time
from datetime import datetime
import uuid
from typing import List, Dict, Any, Union
import logging

# PostgreSQL support
try:
    import psycopg2
    import psycopg2.extras
    POSTGRES_AVAILABLE = True
except ImportError:
    POSTGRES_AVAILABLE = False
    print("⚠️ psycopg2 not available. PostgreSQL support disabled.")

# Transformers
from transformers import AutoTokenizer, AutoModelForSeq2SeqLM
from sentence_transformers import CrossEncoder
import torch

app = Flask(__name__)
CORS(app)

# -------------------- DATABASE SETUP -------------------- #
DATABASE_URL = os.getenv('DATABASE_URL', 'sqlite:///responses.db')

def get_db_connection(max_retries: int = 5, base_delay: float = 1.0):
    db_url = DATABASE_URL
    if db_url.startswith('postgresql://') or db_url.startswith('postgres://'):
        if not POSTGRES_AVAILABLE:
            raise ImportError("PostgreSQL URL provided but psycopg2 not installed")
        for attempt in range(max_retries + 1):
            try:
                conn = psycopg2.connect(db_url)
                conn.autocommit = True
                cursor = conn.cursor()
                cursor.execute('SELECT 1')
                cursor.close()
                return conn
            except (psycopg2.OperationalError, psycopg2.DatabaseError) as e:
                if attempt == max_retries:
                    raise
                time.sleep(base_delay * (2 ** attempt))
    else:
        if db_url.startswith('sqlite:///'):
            db_path = db_url[10:]
        elif db_url.startswith('sqlite://'):
            db_path = db_url[9:]
        else:
            db_path = db_url
        os.makedirs(os.path.dirname(db_path) if os.path.dirname(db_path) else '.', exist_ok=True)
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        return conn

def is_postgres():
    return DATABASE_URL.startswith('postgresql://') or DATABASE_URL.startswith('postgres://')

def execute_query(conn, query: str, params: tuple = ()) -> Union[list, None]:
    if is_postgres():
        cursor = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
        cursor.execute(query, params)
        if query.strip().upper().startswith('SELECT') or 'RETURNING' in query.upper():
            return cursor.fetchall()
        return None
    else:
        cursor = conn.execute(query, params)
        if query.strip().upper().startswith('SELECT'):
            return cursor.fetchall()
        conn.commit()
        return None

def init_db(max_retries: int = 10):
    for attempt in range(max_retries + 1):
        try:
            conn = get_db_connection()
            if is_postgres():
                query = '''
                CREATE TABLE IF NOT EXISTS responses (
                    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                    title VARCHAR(255) NOT NULL,
                    content TEXT NOT NULL,
                    tags JSONB DEFAULT '[]'::jsonb,
                    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                );
                '''
            else:
                query = '''
                CREATE TABLE IF NOT EXISTS responses (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    tags TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
                '''
            execute_query(conn, query)
            conn.close()
            return
        except Exception:
            time.sleep(2 ** attempt)

def dict_from_row(row) -> Dict[str, Any]:
    if is_postgres():
        tags = row['tags'] if row['tags'] is not None else []
        if isinstance(tags, str):
            tags = json.loads(tags)
    else:
        tags = json.loads(row['tags']) if row['tags'] else []
    return {
        'id': str(row['id']),
        'title': row['title'],
        'content': row['content'],
        'tags': tags,
        'created_at': str(row['created_at']) if row['created_at'] else None,
        'updated_at': str(row['updated_at']) if row['updated_at'] else None
    }

# -------------------- TRANSFORMER SETUP -------------------- #
GEN_MODEL = "google/flan-t5-small"
RANKER_MODEL = "cross-encoder/ms-marco-MiniLM-L-6-v2"

tokenizer = AutoTokenizer.from_pretrained(GEN_MODEL)
gen_model = AutoModelForSeq2SeqLM.from_pretrained(GEN_MODEL)
gen_model.eval()
ranker = CrossEncoder(RANKER_MODEL)

# -------------------- EXISTING CRUD ENDPOINTS -------------------- #
# (Paste your /api/responses GET, POST, PUT, DELETE endpoints here)
# ...

# -------------------- NEW TRANSFORMER ENDPOINT -------------------- #
@app.route('/api/generate', methods=['POST'])
def generate_reply():
    """Generate 2-3 professional LinkedIn replies using a transformer and ranker."""
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'Field "text" is required'}), 400

    text = data['text'].strip()
    if not text:
        return jsonify({'error': 'Text cannot be empty'}), 400

    prompt = f"Reply to this LinkedIn message professionally: {text}"
    inputs = tokenizer(prompt, return_tensors="pt")

    outputs = gen_model.generate(
        **inputs,
        do_sample=True,
        top_p=0.9,
        temperature=0.9,
        max_length=64,
        num_return_sequences=3,
        eos_token_id=tokenizer.eos_token_id,
        pad_token_id=tokenizer.pad_token_id
    )

    candidates = [tokenizer.decode(o, skip_special_tokens=True).strip() for o in outputs]
    pairs = [(text, c) for c in candidates]
    try:
        scores = ranker.predict(pairs).tolist()
    except Exception:
        scores = [0.0] * len(candidates)

    packaged = [{'id': i, 'text': c, 'score': float(s)} for i, (c, s) in enumerate(zip(candidates, scores))]
    packaged.sort(key=lambda x: x['score'], reverse=True)
    return jsonify({'candidates': packaged})

# -------------------- HEALTH CHECK -------------------- #
@app.route('/api/health', methods=['GET'])
def health_check():
    try:
        conn = get_db_connection(max_retries=1)
        cursor = conn.cursor() if is_postgres() else conn
        cursor.execute('SELECT 1')
        conn.close()
        return jsonify({'status': 'healthy', 'timestamp': datetime.now().isoformat()})
    except Exception as e:
        return jsonify({'status': 'unhealthy', 'error': str(e)}), 503

# -------------------- MAIN -------------------- #
if __name__ == '__main__':
    logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
    logging.info(f'🔧 Using DATABASE_URL: {DATABASE_URL}')
    try:
        logging.info('🔄 Initializing database...')
        init_db()
        logging.info('🚀 Starting Flask server on http://0.0.0.0:5000')
        app.run(debug=True, host='0.0.0.0', port=5000)
    except Exception as e:
        logging.error(f'❌ Failed to start application: {e}')
        exit(1)
