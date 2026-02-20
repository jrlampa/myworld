import * as THREE from 'three';

class ColorManager {
    constructor() {
        this.cachedColors = new Map();
    }

    getElevationColor(val) {
        if (val < 0.3) return new THREE.Color(0.1, 0.5 + val, 0.1);
        if (val < 0.7) return new THREE.Color(0.4 + val, 0.4, 0.2);
        return new THREE.Color(val, val, val);
    }

    getSlopeColor(slope) {
        const s = Math.min(1.0, slope / 45.0);
        return new THREE.Color(Math.min(1.0, s * 2.0), Math.min(1.0, 2.0 - s * 2.0), 0.1);
    }

    getSolarColor(sol) {
        return new THREE.Color(sol, sol * 0.9, 1.0 - sol);
    }

    getAspectColor(asp) {
        const rad = asp * (Math.PI / 180);
        return new THREE.Color(
            (Math.cos(rad) + 1) / 2,
            (Math.sin(rad) + 1) / 2,
            (Math.cos(rad + Math.PI / 2) + 1) / 2
        );
    }

    getWatershedColor(wId) {
        if (wId <= 0) return new THREE.Color(0.2, 0.2, 0.3);
        const hue = (wId * 137.5) % 360;
        return new THREE.Color(`hsl(${hue}, 70%, 50%)`);
    }

    getTPIColor(val) {
        if (val > 0) return new THREE.Color(0.6 + val * 0.1, 0.4, 0.2);
        return new THREE.Color(0.2, 0.4, 0.6 + Math.abs(val) * 0.1);
    }

    getTRIColor(tri) {
        const val = Math.min(1.0, tri / 5.0);
        return new THREE.Color(val, val * 0.5, 1.0 - val);
    }

    getLandformColor(lf) {
        // 0=Plains (Green), 1=Slopes (Yellow), 2=Ridges (Brown), 3=Valleys (Blue)
        const colors = {
            0: [0.2, 0.8, 0.2],
            1: [0.8, 0.8, 0.2],
            2: [0.6, 0.4, 0.2],
            3: [0.2, 0.4, 0.8],
        };
        const c = colors[lf] || [0.5, 0.5, 0.5];
        return new THREE.Color(c[0], c[1], c[2]);
    }

    getCutFillColor(diff) {
        if (Math.abs(diff) < 0.1) return new THREE.Color(0.8, 0.8, 0.8);
        if (diff > 0) return new THREE.Color(1.0, 0.2, 0.2); // Cut
        return new THREE.Color(0.2, 0.2, 1.0); // Fill
    }

    getStabilityColor(idx) {
        // idx is 0-1 (Risk to Stable)
        if (idx < 0.3) return new THREE.Color(1.0, 0.1, 0.1); // Critical (Red)
        if (idx < 0.6) return new THREE.Color(1.0, 0.9, 0.1); // Moderate (Yellow)
        return new THREE.Color(0.1, 0.9, 0.1); // Stable (Green)
    }

    getCurvatureColor(val) {
        // Concave (Positive) -> Radiant Green, Convex (Negative) -> Electric Blue, Flat -> Slate
        if (Math.abs(val) < 0.005) return new THREE.Color(0.85, 0.85, 0.85);
        if (val > 0) {
            const intensity = Math.min(0.5 + val * 10, 1.0);
            return new THREE.Color(0.1, intensity, 0.1);
        }
        const intensity = Math.min(0.5 + Math.abs(val) * 10, 1.0);
        return new THREE.Color(0.1, 0.1, intensity);
    }

    applyTheme(geom, analysis, mode, state) {
        const colorsAttr = geom.attributes.color;
        const size = analysis.grid_size;
        const count = geom.attributes.position.count;

        const elevs = analysis.elevation_grid.flat();
        const minZ = Math.min(...elevs);
        const maxZ = Math.max(...elevs);
        const range = maxZ - minZ || 1;

        for (let i = 0; i < count; i++) {
            const ix = i % size;
            const iy = Math.floor(i / size);
            const r = size - 1 - iy;
            const c = ix;

            let colorObj;

            switch (mode) {
                case 'natural':
                    colorObj = new THREE.Color(0.38, 0.4, 0.95);
                    break;
                case 'elevation':
                    const eVal = (analysis.elevation_grid[r][c] - minZ) / range;
                    colorObj = this.getElevationColor(eVal);
                    break;
                case 'slope':
                    colorObj = this.getSlopeColor(analysis.slope_degrees ? analysis.slope_degrees[r][c] : 0);
                    break;
                case 'solar':
                    colorObj = this.getSolarColor(analysis.solar_exposure ? analysis.solar_exposure[r][c] : 0.5);
                    break;
                case 'aspect':
                    colorObj = this.getAspectColor(analysis.aspect_degrees ? analysis.aspect_degrees[r][c] : 0);
                    break;
                case 'watershed':
                    colorObj = this.getWatershedColor(analysis.watersheds ? analysis.watersheds[r][c] : 0);
                    break;
                case 'tpi':
                    colorObj = this.getTPIColor(analysis.tpi ? analysis.tpi[r][c] : 0);
                    break;
                case 'tri':
                    const triVal = Array.isArray(analysis.terrain_ruggedness)
                        ? analysis.terrain_ruggedness[r][c]
                        : analysis.terrain_ruggedness || 0;
                    colorObj = this.getTRIColor(triVal);
                    break;
                case 'landform':
                    colorObj = this.getLandformColor(analysis.landforms ? analysis.landforms[r][c] : -1);
                    break;
                case 'stability':
                    colorObj = this.getStabilityColor(analysis.stability_index ? analysis.stability_index[r][c] : 1);
                    break;
                case 'plan_curvature':
                    colorObj = this.getCurvatureColor(analysis.plan_curvature ? analysis.plan_curvature[r][c] : 0);
                    break;
                case 'profile_curvature':
                    colorObj = this.getCurvatureColor(analysis.profile_curvature ? analysis.profile_curvature[r][c] : 0);
                    break;
                case 'cutfill':
                    const currentElev = analysis.elevation_grid[r][c];
                    const target = state.targetElevation || minZ + range / 2;
                    colorObj = this.getCutFillColor(currentElev - target);
                    break;
                default:
                    colorObj = new THREE.Color(0.5, 0.5, 0.5);
            }

            colorsAttr.setXYZ(i, colorObj.r, colorObj.g, colorObj.b);
        }
        colorsAttr.needsUpdate = true;
    }
}

export const colorManager = new ColorManager();
