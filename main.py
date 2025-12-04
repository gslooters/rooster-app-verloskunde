"""Minimale FastAPI app - ALLEEN OR-Tools test."""

from fastapi import FastAPI
from fastapi.responses import HTMLResponse
from datetime import datetime
from ortools.sat.python import cp_model

app = FastAPI(title="Rooster Solver Test")


@app.get("/")
async def root():
    return {
        "app": "Rooster Solver",
        "status": "online",
        "test": "/api/test-solver"
    }


@app.get("/health")
async def health():
    return {"status": "healthy"}


@app.get("/api/test-solver", response_class=HTMLResponse)
async def test_solver():
    """OR-Tools test met 3 medewerkers, 5 dagen, 2 diensten."""
    
    medewerkers = ["Alice", "Bob", "Carol"]
    dagen = ["Ma", "Di", "Wo", "Do", "Vr"]
    diensten = ["Och", "Mid"]
    
    n_m = len(medewerkers)
    n_d = len(dagen)
    n_s = len(diensten)
    
    model = cp_model.CpModel()
    
    shifts = {}
    for m in range(n_m):
        for d in range(n_d):
            for s in range(n_s):
                shifts[(m, d, s)] = model.NewBoolVar(f's_{m}_{d}_{s}')
    
    # Elke dienst precies 1 medewerker
    for d in range(n_d):
        for s in range(n_s):
            model.Add(sum(shifts[(m, d, s)] for m in range(n_m)) == 1)
    
    # Max 1 dienst per dag per medewerker
    for m in range(n_m):
        for d in range(n_d):
            model.Add(sum(shifts[(m, d, s)] for s in range(n_s)) <= 1)
    
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 5.0
    
    start = datetime.now()
    status = solver.Solve(model)
    tijd = (datetime.now() - start).total_seconds()
    
    if status in [cp_model.OPTIMAL, cp_model.FEASIBLE]:
        result = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
        
        rooster = {}
        for d in range(n_d):
            rooster[dagen[d]] = {}
            for s in range(n_s):
                for m in range(n_m):
                    if solver.Value(shifts[(m, d, s)]) == 1:
                        rooster[dagen[d]][diensten[s]] = medewerkers[m]
        
        counts = {}
        for m in range(n_m):
            counts[medewerkers[m]] = sum(
                solver.Value(shifts[(m, d, s)]) 
                for d in range(n_d) for s in range(n_s)
            )
        
        html = f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>OR-Tools Test ✅</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        h1 {{ color: #218085; }}
        table {{
            width: 100%;
            border-collapse: collapse;
            background: white;
            margin: 20px 0;
        }}
        th, td {{
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }}
        th {{ background: #218085; color: white; }}
        .success {{ color: #218085; font-weight: bold; }}
    </style>
</head>
<body>
    <h1>✅ OR-Tools Test GESLAAGD!</h1>
    <p class="success">Status: {result}</p>
    <p>Oplostijd: {tijd:.3f} seconden</p>
    
    <h2>Rooster</h2>
    <table>
        <tr>
            <th>Dag</th>
            <th>Ochtend</th>
            <th>Middag</th>
        </tr>"""
        
        for dag in dagen:
            och = rooster[dag].get("Och", "-")
            mid = rooster[dag].get("Mid", "-")
            html += f"""
        <tr>
            <td><b>{dag}</b></td>
            <td>{och}</td>
            <td>{mid}</td>
        </tr>"""
        
        html += """
    </table>
    
    <h2>Diensten per Medewerker</h2>
    <table>
        <tr>
            <th>Medewerker</th>
            <th>Aantal</th>
        </tr>"""
        
        for name, count in counts.items():
            html += f"""
        <tr>
            <td>{name}</td>
            <td>{count}</td>
        </tr>"""
        
        html += """
    </table>
    <p><a href="/">← Terug</a> | <a href="/health">Health</a></p>
</body>
</html>
        """
        return html
    
    else:
        return f"""
<!DOCTYPE html>
<html>
<head><title>Fout</title></head>
<body>
    <h1>Geen oplossing</h1>
    <p>Status: {status}</p>
    <p>Tijd: {tijd:.3f}s</p>
</body>
</html>
        """


if __name__ == "__main__":
    import uvicorn
    import os
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port)
