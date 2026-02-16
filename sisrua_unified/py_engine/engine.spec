# -*- mode: python ; coding: utf-8 -*-
from PyInstaller.utils.hooks import collect_all

# Collect all for complex spatial libraries
datas_ox, binaries_ox, hidden_ox = collect_all('osmnx')
datas_gpd, binaries_gpd, hidden_gpd = collect_all('geopandas')
datas_pj, binaries_pj, hidden_pj = collect_all('pyproj')

a = Analysis(
    ['main.py'],
    pathex=['py_engine', '.'],
    binaries=binaries_ox + binaries_gpd + binaries_pj,
    datas=[
        ('utils', 'utils'),
    ] + datas_ox + datas_gpd + datas_pj,
    hiddenimports=[
        'ezdxf',
        'numpy',
        'pandas',
        'shapely',
        'requests',
        'rasterio',
        'skimage',
        'scipy',
        'math',
        'json',
        'sqlite3',
        'pyogrio',
        'fiona',
        'rtree',
        'controller',
        'dxf_generator',
        'dxf_styles',
        'osmnx_client',
        'elevation_client',
        'spatial_audit',
        'contour_generator'
    ] + hidden_ox + hidden_gpd + hidden_pj,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    noarchive=False,
    optimize=0,
)
pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    [],
    name='sisrua_engine',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=True,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
