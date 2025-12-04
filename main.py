"""FastAPI application serving Next.js frontend and providing backend APIs."""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, HTMLResponse
import os
from pathlib import Path
from datetime import datetime, timedelta

# OR-Tools import
from ortools.sat.python import cp_model

app = FastAPI(
    title="Rooster App Verloskunde",
    description="Planning application for healthcare practice",
    version="3.0.0-railway"
)

# CORS middleware - allow all origins for now (configure for production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production: specify exact domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Health check endpoint for Railway
@app.get("/health")
async def health_check():
    return {"status": "healthy", "version": "3.0.0-railway"}

# API endpoints
@app.get("/api/version")
async def get_version():
    return {
        "version": "3.0.0-railway",
        "backend": "FastAPI",
        "frontend": "Next.js Static Export",
        "ortools": "9.14.6206"
    }


# ============================================================
# STAP 2: OR-TOOLS TEST ENDPOINT
# ============================================================

@app.get("/api/test-solver", response_class=HTMLResponse)
async def test_solver():
    """
    Test OR-Tools CP-SAT solver met een simpel rooster probleem.
    
    Scenario:
    - 3 medewerkers (Alice, Bob, Carol)
    - 5 dagen (Maandag t/m Vrijdag)
    - 2 diensten per dag (Ochtend, Middag)
    - Regel: Elke medewerker max 1 dienst per dag
    - Regel: Elke dienst moet bezet zijn
    """
    
    # Data setup
    medewerkers = ["Alice", "Bob", "Carol"]
    dagen = ["Maandag", "Dinsdag", "Woensdag", "Donderdag", "Vrijdag"]
    diensten = ["Ochtend", "Middag"]
    
    num_medewerkers = len(medewerkers)
    num_dagen = len(dagen)
    num_diensten = len(diensten)
    
    # Create CP-SAT model
    model = cp_model.CpModel()
    
    # Decision variables
    # shifts[(m, d, s)] = 1 if medewerker m works dienst s on dag d
    shifts = {}
    for m in range(num_medewerkers):
        for d in range(num_dagen):
            for s in range(num_diensten):
                shifts[(m, d, s)] = model.NewBoolVar(f'shift_m{m}_d{d}_s{s}')
    
    # Constraint 1: Elke dienst moet door precies 1 medewerker worden gedaan
    for d in range(num_dagen):
        for s in range(num_diensten):
            model.Add(sum(shifts[(m, d, s)] for m in range(num_medewerkers)) == 1)
    
    # Constraint 2: Elke medewerker max 1 dienst per dag
    for m in range(num_medewerkers):
        for d in range(num_dagen):
            model.Add(sum(shifts[(m, d, s)] for s in range(num_diensten)) <= 1)
    
    # Constraint 3: Probeer diensten eerlijk te verdelen (soft constraint via objective)
    # Tel aantal diensten per medewerker
    shifts_per_medewerker = []
    for m in range(num_medewerkers):
        shifts_count = model.NewIntVar(0, num_dagen * num_diensten, f'shifts_count_m{m}')
        model.Add(shifts_count == sum(
            shifts[(m, d, s)] 
            for d in range(num_dagen) 
            for s in range(num_diensten)
        ))
        shifts_per_medewerker.append(shifts_count)
    
    # Minimize verschil tussen max en min aantal diensten (eerlijke verdeling)
    max_shifts = model.NewIntVar(0, num_dagen * num_diensten, 'max_shifts')
    min_shifts = model.NewIntVar(0, num_dagen * num_diensten, 'min_shifts')
    
    model.AddMaxEquality(max_shifts, shifts_per_medewerker)
    model.AddMinEquality(min_shifts, shifts_per_medewerker)
    
    # Minimize difference
    diff = model.NewIntVar(0, num_dagen * num_diensten, 'diff')
    model.Add(diff == max_shifts - min_shifts)
    model.Minimize(diff)
    
    # Solve
    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = 10.0
    
    start_time = datetime.now()
    status = solver.Solve(model)
    solve_time = (datetime.now() - start_time).total_seconds()
    
    # Build result
    if status == cp_model.OPTIMAL or status == cp_model.FEASIBLE:
        result_status = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
        
        # Build rooster
        rooster = {}
        for d in range(num_dagen):
            rooster[dagen[d]] = {}
            for s in range(num_diensten):
                for m in range(num_medewerkers):
                    if solver.Value(shifts[(m, d, s)]) == 1:
                        rooster[dagen[d]][diensten[s]] = medewerkers[m]
        
        # Count shifts per medewerker
        shift_counts = {}
        for m in range(num_medewerkers):
            count = sum(
                solver.Value(shifts[(m, d, s)]) 
                for d in range(num_dagen) 
                for s in range(num_diensten)
            )
            shift_counts[medewerkers[m]] = count
        
        # Generate HTML
        html = f"""
        <!DOCTYPE html>
        <html lang="nl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>OR-Tools Test - GESLAAGD ✅</title>
            <style>
                :root {{
                    --color-bg: #fcfcf9;
                    --color-surface: #fffffe;
                    --color-primary: #218085;
                    --color-text: #134252;
                    --color-border: rgba(94, 82, 64, 0.2);
                    --color-success: #218085;
                    --color-alice: #e3f2fd;
                    --color-bob: #fff3e0;
                    --color-carol: #f3e5f5;
                }}
                
                * {{
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }}
                
                body {{
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
                    background: var(--color-bg);
                    color: var(--color-text);
                    padding: 20px;
                    line-height: 1.6;
                }}
                
                .container {{
                    max-width: 1000px;
                    margin: 0 auto;
                }}
                
                .header {{
                    text-align: center;
                    margin-bottom: 40px;
                }}
                
                .header h1 {{
                    font-size: 32px;
                    color: var(--color-success);
                    margin-bottom: 10px;
                }}
                
                .badge {{
                    display: inline-block;
                    padding: 6px 12px;
                    background: rgba(33, 128, 133, 0.15);
                    color: var(--color-success);
                    border-radius: 20px;
                    font-weight: 500;
                    font-size: 14px;
                    border: 1px solid rgba(33, 128, 133, 0.25);
                }}
                
                .stats {{
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 20px;
                    margin-bottom: 40px;
                }}
                
                .stat-card {{
                    background: var(--color-surface);
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid var(--color-border);
                }}
                
                .stat-card h3 {{
                    font-size: 14px;
                    color: rgba(19, 66, 82, 0.6);
                    margin-bottom: 8px;
                }}
                
                .stat-card .value {{
                    font-size: 28px;
                    font-weight: 600;
                    color: var(--color-primary);
                }}
                
                .rooster-table {{
                    background: var(--color-surface);
                    border-radius: 12px;
                    overflow: hidden;
                    border: 1px solid var(--color-border);
                    margin-bottom: 40px;
                }}
                
                table {{
                    width: 100%;
                    border-collapse: collapse;
                }}
                
                th {{
                    background: var(--color-primary);
                    color: white;
                    padding: 16px;
                    text-align: left;
                    font-weight: 500;
                }}
                
                td {{
                    padding: 16px;
                    border-bottom: 1px solid var(--color-border);
                }}
                
                tr:last-child td {{
                    border-bottom: none;
                }}
                
                .medewerker-alice {{ background: var(--color-alice); }}
                .medewerker-bob {{ background: var(--color-bob); }}
                .medewerker-carol {{ background: var(--color-carol); }}
                
                .shift-counts {{
                    background: var(--color-surface);
                    padding: 20px;
                    border-radius: 12px;
                    border: 1px solid var(--color-border);
                }}
                
                .shift-counts h2 {{
                    margin-bottom: 16px;
                }}
                
                .shift-count-item {{
                    display: flex;
                    justify-content: space-between;
                    padding: 12px;
                    margin-bottom: 8px;
                    border-radius: 8px;
                }}
                
                .back-link {{
                    display: inline-block;
                    margin-top: 40px;
                    padding: 12px 24px;
                    background: var(--color-primary);
                    color: white;
                    text-decoration: none;
                    border-radius: 8px;
                    font-weight: 500;
                }}
                
                .back-link:hover {{
                    background: #1a6a6e;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✅ OR-Tools Test GESLAAGD!</h1>
                    <p style="margin-top: 10px; color: rgba(19, 66, 82, 0.7);">
                        Google OR-Tools CP-SAT Solver werkt perfect met Railway deployment
                    </p>
                    <div style="margin-top: 20px;">
                        <span class="badge">{result_status}</span>
                    </div>
                </div>
                
                <div class="stats">
                    <div class="stat-card">
                        <h3>Oplosstatus</h3>
                        <div class="value">{result_status}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Oplostijd</h3>
                        <div class="value">{solve_time:.3f}s</div>
                    </div>
                    <div class="stat-card">
                        <h3>Medewerkers</h3>
                        <div class="value">{num_medewerkers}</div>
                    </div>
                    <div class="stat-card">
                        <h3>Totaal Diensten</h3>
                        <div class="value">{num_dagen * num_diensten}</div>
                    </div>
                </div>
                
                <div class="rooster-table">
                    <table>
                        <thead>
                            <tr>
                                <th>Dag</th>
                                <th>Ochtend</th>
                                <th>Middag</th>
                            </tr>
                        </thead>
                        <tbody>
        """
        
        for dag in dagen:
            ochtend = rooster[dag].get("Ochtend", "-")
            middag = rooster[dag].get("Middag", "-")
            ochtend_class = f"medewerker-{ochtend.lower()}" if ochtend != "-" else ""
            middag_class = f"medewerker-{middag.lower()}" if middag != "-" else ""
            
            html += f"""
                            <tr>
                                <td><strong>{dag}</strong></td>
                                <td class="{ochtend_class}">{ochtend}</td>
                                <td class="{middag_class}">{middag}</td>
                            </tr>
            """
        
        html += """
                        </tbody>
                    </table>
                </div>
                
                <div class="shift-counts">
                    <h2>Diensten per Medewerker (Eerlijke Verdeling)</h2>
        """
        
        for medewerker, count in shift_counts.items():
            medewerker_class = f"medewerker-{medewerker.lower()}"
            html += f"""
                    <div class="shift-count-item {medewerker_class}">
                        <span><strong>{medewerker}</strong></span>
                        <span>{count} diensten</span>
                    </div>
            """
        
        html += f"""
                </div>
                
                <div style="text-align: center;">
                    <a href="/" class="back-link">← Terug naar Homepage</a>
                    <a href="/api/version" class="back-link" style="margin-left: 10px; background: rgba(33, 128, 133, 0.15); color: var(--color-primary);">API Info</a>
                </div>
                
                <div style="margin-top: 40px; padding: 20px; background: #f0f9ff; border-radius: 8px; border-left: 4px solid var(--color-primary);">
                    <h3 style="margin-bottom: 10px;">✅ STAP 2 COMPLEET</h3>
                    <p style="color: rgba(19, 66, 82, 0.8);">
                        <strong>Wat is getest:</strong><br>
                        • OR-Tools CP-SAT solver draait succesvol op Railway<br>
                        • Constraints worden correct toegepast<br>
                        • Oplossing is optimaal of feasible<br>
                        • HTML rendering werkt perfect<br><br>
                        <strong>Volgende stap:</strong> STAP 3 - Verbinding met Supabase database
                    </p>
                </div>
            </div>
        </body>
        </html>
        """
        
        return html
        
    else:
        # No solution found
        html = f"""
        <!DOCTYPE html>
        <html lang="nl">
        <head>
            <meta charset="UTF-8">
            <title>OR-Tools Test - Geen Oplossing</title>
        </head>
        <body style="font-family: sans-serif; padding: 40px; text-align: center;">
            <h1 style="color: #c0152f;">❌ Geen Oplossing Gevonden</h1>
            <p>Solver status: {status}</p>
            <p>Oplostijd: {solve_time:.3f} seconden</p>
            <a href="/" style="display: inline-block; margin-top: 20px; padding: 10px 20px; background: #218085; color: white; text-decoration: none; border-radius: 5px;">Terug</a>
        </body>
        </html>
        """
        return html


# ============================================================
# NEXT.JS STATIC FILES
# ============================================================

# Mount Next.js static files
static_dir = Path("out")
if static_dir.exists():
    # Serve Next.js build output
    app.mount("/_next", StaticFiles(directory="out/_next"), name="nextjs")
    app.mount("/static", StaticFiles(directory="out"), name="static")
    
    # Catch-all route for Next.js pages
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        # Try to serve the requested file
        file_path = static_dir / full_path
        
        # If it's a file, serve it
        if file_path.is_file():
            return FileResponse(file_path)
        
        # If it's a directory or doesn't exist, try index.html
        index_path = static_dir / full_path / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
        
        # Fallback to root index.html (SPA fallback)
        return FileResponse(static_dir / "index.html")
else:
    @app.get("/")
    async def root():
        return {
            "message": "Frontend not built yet. Run 'npm run build' first.",
            "backend_status": "operational"
        }

if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
