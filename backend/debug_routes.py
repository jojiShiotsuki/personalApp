from app.main import app
import sys

def print_routes():
    print("Registered Routes:")
    for route in app.routes:
        if hasattr(route, "path"):
            print(f"{route.methods} {route.path}")
        else:
            print(route)

if __name__ == "__main__":
    print_routes()
