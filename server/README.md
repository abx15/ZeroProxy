# ZeroProxy AI/ML Service

FastAPI AI/ML service for Smart Face Auth + Employee Monitoring.

## Setup & Run

1. **Prerequisites**: Ensure you have Python 3.11 installed.
2. **Create Virtual Environment**:
   ```bash
   py -3.11 -m venv .venv
   ```
3. **Activate & Install Dependencies**:
   - On Windows (PowerShell):
     ```powershell
     .\.venv\Scripts\Activate.ps1
     pip install -r requirements.txt
     ```
   - On Linux/macOS:
     ```bash
     source .venv/bin/activate
     pip install -r requirements.txt
     ```
4. **Environment Variables**:
   Copy `.env.example` to `.env` and configure your settings:
   ```bash
   cp .env.example .env
   ```

5. **Run the Server**:
   ```bash
   uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
   ```

## Running Tests

Run unit tests via `pytest`:
```bash
python -m pytest tests/ -v
```
