"""
Backend Automation Script
This script performs the following steps:
1. Installs required dependencies from requirements.txt
2. Initializes the database (via sql_alchemy import)
3. Fetches and populates data from SDMX sources
4. Launches the FastAPI application
"""
import os
import sys
import subprocess
import time


def run_command(command, description, shell=True):
    """Execute a shell command and handle errors."""
    print(f"\n{'='*60}")
    print(f"STEP: {description}")
    print(f"{'='*60}")
    print(f"Running: {command}\n")
    
    try:
        result = subprocess.run(
            command,
            shell=shell,
            check=True,
            text=True,
            capture_output=False
        )
        print(f"✓ {description} completed successfully")
        return True
    except subprocess.CalledProcessError as e:
        print(f"✗ Error during {description}")
        print(f"Error: {e}")
        return False


def main():
    """Main execution flow."""
    print("\n" + "="*60)
    print("STATEC HACKATHON - BACKEND SETUP & LAUNCH")
    print("="*60)
    
    # Get the backend directory path
    backend_dir = os.path.join(os.getcwd(), "dashboard", "backend")
    requirements_file = os.path.join("requirements.txt")
    
    # Check if requirements.txt exists
    if not os.path.exists(requirements_file):
        print(f"✗ Error: requirements.txt not found at {requirements_file}")
        sys.exit(1)
    
    # Step 1: Install requirements
    install_cmd = f"pip install -r {requirements_file}"
    if not run_command(install_cmd, "Installing requirements"):
        print("\n⚠ Failed to install requirements. Please check the error above.")
        response = input("Do you want to continue anyway? (y/n): ")
        if response.lower() != 'y':
            sys.exit(1)
    
    # Step 2: Initialize database (happens automatically via sql_alchemy import)
    print(f"\n{'='*60}")
    print("STEP: Initializing Database")
    print(f"{'='*60}")
    print("Database will be initialized via SQLAlchemy...")
    
    # Step 3: Fetch and populate data
    print(f"\n{'='*60}")
    print("STEP: Fetching and Populating Data")
    print(f"{'='*60}")
    print("This may take several minutes depending on the data sources...")
    
    # Change to backend directory to run data_fetch.py
    original_dir = os.getcwd()
    os.chdir(backend_dir)
    
    try:
        fetch_cmd = "python data_fetch.py"
        if not run_command(fetch_cmd, "Data fetching"):
            print("\n⚠ Warning: Data fetch encountered issues.")
            response = input("Do you want to continue to launch the API anyway? (y/n): ")
            if response.lower() != 'y':
                os.chdir(original_dir)
                sys.exit(1)
    finally:
        os.chdir(original_dir)
    
    # Step 4: Launch the API
    print(f"\n{'='*60}")
    print("STEP: Launching FastAPI Application")
    print(f"{'='*60}")
    print("Starting server on http://localhost:8000")
    print("Swagger UI will be available at http://localhost:8000/docs")
    print("\nPress CTRL+C to stop the server")
    print(f"{'='*60}\n")

    print("Now do npm install inside the dashboard/frontend directory to install frontend dependencies.\n")
    print("Then run the frontend with 'npm start' inside the dashboard/frontend directory.\n")
    
    # Change to backend directory and run the API
    os.chdir(backend_dir)
    
    try:
        # Run the API (this will block until CTRL+C)
        api_cmd = "python main_api.py"
        subprocess.run(api_cmd, shell=True, check=True)
    except KeyboardInterrupt:
        print("\n\n" + "="*60)
        print("Server stopped by user")
        print("="*60)
    except Exception as e:
        print(f"\n✗ Error launching API: {e}")
        os.chdir(original_dir)
        sys.exit(1)
    finally:
        os.chdir(original_dir)


if __name__ == "__main__":
    main()
