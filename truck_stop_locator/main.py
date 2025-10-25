import json
import os
from urllib import request, parse
import tkinter as tk
from tkinter import messagebox

def fetch_truck_stops():
    """Fetch truck stop locations and save to a JSON file."""
    overpass_url = "https://overpass-api.de/api/interpreter"
    query = """
    [out:json][timeout:50];
    (
      node["amenity"="fuel"]["brand"~"(?i)love's|flying j|pilot|travelcenters of america|petro|\\bta\\b"](24.5,-125,49.5,-66.5);
      node["amenity"="fuel"]["name"~"(?i)love's|flying j|pilot|travelcenters of america|petro|\\bta\\b"](24.5,-125,49.5,-66.5);
      way["amenity"="fuel"]["brand"~"(?i)love's|flying j|pilot|travelcenters of america|petro|\\bta\\b"](24.5,-125,49.5,-66.5);
      way["amenity"="fuel"]["name"~"(?i)love's|flying j|pilot|travelcenters of america|petro|\\bta\\b"](24.5,-125,49.5,-66.5);
    );
    out center;
    """
    data = parse.urlencode({'data': query}).encode('utf-8')
    try:
        with request.urlopen(overpass_url, data=data) as response:
            result = json.loads(response.read())
    except Exception as exc:
        messagebox.showerror("Error", f"Failed to fetch data: {exc}")
        return

    stops = []
    for element in result.get('elements', []):
        lat = element.get('lat') or element.get('center', {}).get('lat')
        lon = element.get('lon') or element.get('center', {}).get('lon')
        tags = element.get('tags', {})
        name = tags.get('name') or tags.get('brand', 'Unknown')
        if lat is None or lon is None:
            continue
        stops.append({'name': name, 'lat': lat, 'lon': lon})

    output_path = os.path.join(os.path.dirname(__file__), 'truck_stops.json')
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(stops, f, indent=2)

    messagebox.showinfo("Complete", f"Saved {len(stops)} truck stops to {output_path}")


def main():
    window = tk.Tk()
    window.title("Truck Stop Locator")

    label = tk.Label(window, text="Fetch US Truck Stops", font=("Arial", 14))
    label.pack(padx=20, pady=10)

    fetch_button = tk.Button(window, text="Fetch Truck Stops", command=fetch_truck_stops)
    fetch_button.pack(padx=20, pady=10)

    window.mainloop()

if __name__ == "__main__":
    main()
