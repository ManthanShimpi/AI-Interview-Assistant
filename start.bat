@echo off
echo ====================================================
echo Starting Local AI Interview Assistant (Parallel)
echo ====================================================
echo Spawning separate instances for Backend and Frontend.
echo Please look for the two new command prompt windows!
echo.
echo NOTE: Upon first run, the Backend requires a massive 
echo download (PyTorch, librosa, and NLP Machine Learning 
echo models approx ~3GB). It may appear stuck, but it is 
echo downloading in the background. Please wait for it.
echo ====================================================
echo.

start "AI Backend Service (FastAPI)" cmd /k "cd backend & if not exist venv (python -m venv venv) & call venv\Scripts\activate & echo Checking AI dependencies... & pip install -r requirements.txt & python -m spacy download en_core_web_sm & echo Starting Server... & uvicorn main:app --reload --host 0.0.0.0 --port 8000"

start "AI Frontend UI (React/Vite)" cmd /k "cd frontend & echo Checking Frontend Dependencies... & call npm install & echo Starting UI Server... & npm run dev"

echo Both services have been initiated in separate windows.
echo Keep those new windows open. Once the Frontend window
echo displays "➜  Local:   http://localhost:5173/", reload 
echo your browser!
pause
