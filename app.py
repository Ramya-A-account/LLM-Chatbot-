from flask import Flask, request, jsonify
from flask_cors import CORS
from groq import Groq
import requests
import os
import uuid
from datetime import datetime
from dotenv import load_dotenv

load_dotenv()

app = Flask(__name__)
CORS(app, origins=["*"])

# API Keys
groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
SERPER_KEY = os.environ.get("SERPER_API_KEY")

GROQ_MODEL = "llama-3.1-8b-instant"

conversations = {}

SYSTEM_PROMPT = """You are EduHub Assistant for Indian students.

RULES:
1. Use ONLY real links from search results
2. NEVER guess dates
3. If date unknown → say "Check official website"
4. Format:
   Event Name | Date | Location | Eligibility | Registration Link
5. Be clear and structured
"""

# 🔥 SERPER REAL SEARCH
def real_search(query):
    try:
        url = "https://google.serper.dev/search"
        headers = {
            "X-API-KEY": SERPER_KEY,
            "Content-Type": "application/json"
        }
        payload = {"q": query}

        res = requests.post(url, json=payload, headers=headers)
        data = res.json()

        results = data.get("organic", [])[:5]

        if not results:
            return "No results found."

        return "\n".join([
            f"• {r['title']} — {r['link']}" for r in results
        ])

    except Exception as e:
        return f"Search error: {str(e)}"


# ───────── ROUTES ─────────

@app.route("/")
def home():
    return "EduHub Backend Running 🚀"


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "model": GROQ_MODEL,
        "timestamp": datetime.now().isoformat()
    })


@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.get_json()

    user_message = data.get("message", "").strip()
    student_type = data.get("student_type", "auto")
    location = data.get("location", "India")
    session_id = data.get("session_id") or str(uuid.uuid4())

    if not user_message:
        return jsonify({"error": "Empty message"}), 400

    if session_id not in conversations:
        conversations[session_id] = []

    # 🔥 REAL SEARCH
    search_results = real_search(f"{user_message} {location}")

    enhanced_prompt = f"""
Student type: {student_type}
Location: {location}

User Query: {user_message}

LIVE SEARCH RESULTS:
{search_results}

Use the above real links to answer.
"""

    conversations[session_id].append({
        "role": "user",
        "content": enhanced_prompt
    })

    history = conversations[session_id][-10:]

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + history,
            max_tokens=1200,
            temperature=0.7,
        )

        reply = response.choices[0].message.content

        conversations[session_id].append({
            "role": "assistant",
            "content": reply
        })

        return jsonify({
            "response": reply,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat(),
            "searched": True
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/quick", methods=["POST"])
def quick():
    data = request.get_json()

    category = data.get("category", "")
    location = data.get("location", "India")
    session_id = data.get("session_id") or str(uuid.uuid4())

    query_map = {
        "hackathons": "latest hackathons India",
        "internships": "latest internships India students",
        "jobs": "freshers job openings India",
        "symposiums": "college symposiums India",
        "sports": "school sports competitions India",
        "coding": "coding contests 2026",
        "govt_jobs": "government jobs India latest",
    }

    query = query_map.get(category, f"{category} opportunities {location}")

    search_results = real_search(query)

    prompt = f"""
Category: {category}
Location: {location}

Search Results:
{search_results}

Give structured answer.
"""

    if session_id not in conversations:
        conversations[session_id] = []

    conversations[session_id].append({
        "role": "user",
        "content": prompt
    })

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[{"role": "system", "content": SYSTEM_PROMPT}] + conversations[session_id][-8:],
            max_tokens=1200,
            temperature=0.7,
        )

        reply = response.choices[0].message.content

        return jsonify({
            "response": reply,
            "session_id": session_id,
            "timestamp": datetime.now().isoformat()
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/clear", methods=["POST"])
def clear():
    data = request.get_json()
    sid = data.get("session_id")

    if sid in conversations:
        conversations[sid] = []

    return jsonify({"status": "cleared"})


@app.route("/api/history", methods=["GET"])
def history():
    sid = request.args.get("session_id")
    return jsonify({"history": conversations.get(sid, [])})


if __name__ == "__main__":
    print("🚀 EduHub Backend running on http://localhost:5000")
    app.run(debug=True, port=5000)