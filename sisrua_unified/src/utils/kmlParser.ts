export const parseKml = async (file: File): Promise<[number, number][]> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const parser = new DOMParser();
                const xmlDoc = parser.parseFromString(text, "text/xml");

                // Try to find a Polygon first
                const coordinates = xmlDoc.getElementsByTagName("coordinates");

                if (coordinates.length === 0) {
                    reject(new Error("No coordinates found in KML."));
                    return;
                }

                // Get the first coordinate set (usually the main boundary)
                const rawCoords = coordinates[0].textContent?.trim();
                if (!rawCoords) {
                    reject(new Error("Empty coordinates tag."));
                    return;
                }

                const points: [number, number][] = [];
                const pairs = rawCoords.split(/\s+/);

                for (const pair of pairs) {
                    const parts = pair.split(',');
                    if (parts.length >= 2) {
                        const lon = parseFloat(parts[0]);
                        const lat = parseFloat(parts[1]);
                        // KML is lon,lat. Leaflet is lat,lon.
                        if (!isNaN(lat) && !isNaN(lon)) {
                            points.push([lat, lon]);
                        }
                    }
                }

                if (points.length < 3) {
                    reject(new Error("Valid polygon needs at least 3 points."));
                    return;
                }

                resolve(points);
            } catch (err) {
                reject(err);
            }
        };
        reader.onerror = () => reject(new Error("Failed to read file."));
        reader.readAsText(file);
    });
};
