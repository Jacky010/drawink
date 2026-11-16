export const toolbarStyle = `
.drawink-toolbar{box-sizing:border-box;position:absolute;top:16px;left:50%;transform:translateX(-50%);z-index:5;display:flex;align-items:center;gap:5px;padding:9px 12px;width:max-content;max-width:calc(100% - 24px);border:1px solid #eeedf7;border-radius:16px;background:#fff;box-shadow:0 7px 28px #43407814;font:13px/1.4 "Segoe UI","Microsoft YaHei",sans-serif;color:#61646b;isolation:isolate}
.drawink-toolbar{flex-wrap:wrap;justify-content:center}
.drawink-toolbar .drawink-brush-menu{left:0;right:auto}
.drawink-toolbar .drawink-brush-preview{border-radius:10px;width:100%;min-height:1px;margin:6px 0}
.drawink-toolbar .drawink-brush-menu input[type=range]{width:110px;accent-color:#9582ec}
.drawink-toolbar input:focus-visible{outline:2px solid #9582ec;outline-offset:2px}
.drawink-toolbar .drawink-zoom-bar{position:absolute;top:calc(100% + 8px);right:0;display:flex;align-items:center;gap:2px;padding:5px;border:1px solid #eeedf7;border-radius:12px;background:#fff;box-shadow:0 5px 18px #43407812}
.drawink-toolbar .drawink-export-status{position:absolute;top:calc(100% + 56px);right:0;width:300px;max-width:calc(100vw - 40px);padding:12px;border:1px solid #f2d6d3;border-radius:10px;background:#fff;color:#a33e34;overflow-wrap:anywhere;box-shadow:0 5px 18px #43407812}
.drawink-toolbar .drawink-export-menu p{margin:0;color:#8a8694;font-size:12px;line-height:1.6}
.drawink-toolbar .drawink-export-menu .drawink-save-image{width:100%;background:#7763d7;color:#fff}
.drawink-toolbar[data-placement=bottom] .drawink-zoom-bar,.drawink-toolbar[data-placement=bottom] .drawink-shape-menu,.drawink-toolbar[data-placement=bottom] .drawink-background-menu{top:auto;bottom:calc(100% + 10px)}
.drawink-toolbar[data-placement=bottom] .drawink-export-status{top:auto;bottom:calc(100% + 56px)}
.drawink-toolbar .drawink-background-menu,.drawink-toolbar .drawink-shape-menu{z-index:2;max-height:var(--drawink-panel-height,290px);overflow:auto}
.drawink-toolbar .drawink-export-status{z-index:3}
.drawink-toolbar *{box-sizing:border-box}
.drawink-toolbar .drawink-icon{display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;flex:0 0 20px;line-height:1;pointer-events:none;overflow:hidden;font-size:20px}
.drawink-toolbar .drawink-icon img,.drawink-toolbar .drawink-icon svg{display:block;width:100%;height:100%;object-fit:contain}
.drawink-toolbar .drawink-icon i{font-style:normal}
.drawink-toolbar [hidden]{display:none!important}
.drawink-toolbar button{display:inline-flex;align-items:center;justify-content:center;gap:5px;flex-shrink:0;min-width:32px;height:32px;padding:5px 7px;background:transparent;border:0;border-radius:8px;color:inherit;font:inherit;cursor:pointer}
.drawink-toolbar button:hover{background:#f4f2ff;color:#7262d4}
.drawink-toolbar button[aria-pressed=true]{background:#e8e2ff;color:#7763d7}
.drawink-toolbar button:disabled{opacity:.32;cursor:default;background:transparent}
.drawink-toolbar button:focus-visible,.drawink-toolbar select:focus-visible{outline:2px solid #9582ec;outline-offset:2px}
.drawink-toolbar .drawink-divider{height:22px;width:1px;background:#eeedf5;margin:0 5px;flex-shrink:0}
.drawink-toolbar .drawink-mode{border:0;border-radius:6px;background:#f7f6fc;color:#66616f;font:inherit;padding:6px 4px;max-width:110px;cursor:pointer}
.drawink-toolbar .drawink-shape-menu{position:absolute;top:calc(100% + 10px);left:0;padding:10px;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:5px;width:300px;max-width:calc(100vw - 40px);max-height:290px;overflow:auto;border:1px solid #eeedf7;border-radius:14px;background:#fff;box-shadow:0 8px 30px #4340781c;color:#62616d}
.drawink-toolbar .drawink-shape-menu[hidden]{display:none}
.drawink-toolbar .drawink-shape-menu button{height:58px;min-width:0;flex-direction:column;font-size:11px;white-space:nowrap}
.drawink-toolbar .drawink-custom-items{display:flex;gap:4px;align-items:center}
.drawink-toolbar .drawink-custom-items:empty{display:none}
.drawink-toolbar .drawink-danger{color:#d77d79}
.drawink-toolbar .drawink-custom-divider[hidden]{display:none}

.drawink-toolbar .drawink-background-menu{position:absolute;top:calc(100% + 10px);right:0;width:244px;max-width:calc(100vw - 40px);padding:15px;border:1px solid #eeedf7;border-radius:14px;background:#fff;box-shadow:0 8px 30px #4340781c;display:flex;flex-direction:column;gap:12px}
.drawink-toolbar .drawink-background-menu label{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:12px}
.drawink-toolbar .drawink-background-menu input[type=color]{width:40px;height:27px;padding:2px;border:1px solid #e3dfef;border-radius:6px;background:#fff;cursor:pointer}
.drawink-toolbar .drawink-background-menu select,.drawink-toolbar .drawink-background-menu input[type=number]{max-width:108px;border:1px solid #e3dfef;border-radius:6px;padding:4px;color:#625e70;background:#fff;font:inherit}
.drawink-toolbar .drawink-background-menu input[type=number]{width:66px}
.drawink-toolbar .drawink-color-presets{display:flex;justify-content:space-between;gap:8px}
.drawink-toolbar .drawink-color-presets button{min-width:34px;width:34px;height:25px;border:1px solid #dedbea;border-radius:6px}
@media(max-width:640px){.drawink-toolbar{gap:2px;padding:7px;flex-wrap:wrap;justify-content:center}.drawink-toolbar .drawink-divider{margin:0 2px}.drawink-toolbar button{min-width:28px;padding:4px}.drawink-toolbar .drawink-mode{max-width:90px}}
`
