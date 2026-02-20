import React, { useRef, useEffect } from "react";
// dxf-parser e dxf-viewer devem ser instalados como dependências
// npm install dxf-parser dxf-viewer

interface DxfPreviewProps {
  dxfContent: string; // Conteúdo do arquivo DXF (string)
}

const DxfPreview: React.FC<DxfPreviewProps> = ({ dxfContent }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!dxfContent || !containerRef.current) return;
    // Carrega dxf-viewer dinamicamente para evitar SSR issues
    import("dxf-viewer").then((DXFViewer) => {
      // Limpa container
      containerRef.current!.innerHTML = "";
      // Cria viewer
      const viewer = new DXFViewer.default({
        container: containerRef.current!,
        width: 600,
        height: 400,
        backgroundColor: "#fff",
      });
      viewer.load(dxfContent);
    });
  }, [dxfContent]);

  return <div ref={containerRef} style={{ width: 600, height: 400, border: "1px solid #ccc" }} />;
};

export default DxfPreview;
