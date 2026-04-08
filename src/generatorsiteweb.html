'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { Loader2, Save, Eye, X } from 'lucide-react'
import { toast } from 'sonner'

interface GrapesJSEditorProps {
  formationId: string
  initialHtml?: string
  initialCss?: string
  initialComponents?: string
  initialStyles?: string
  onSave?: (data: { html_content: string; css_content: string; components_json: string; style_json: string }) => void
  onClose?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type GrapesJSEditor = any

const NYXIA_PREMIUM_CSS = `
/* === FONT === */
.gjs-one-bg, .gjs-two-bg, .gjs-three-bg, .gjs-four-bg {
  font-family: 'Outfit', ui-sans-serif, system-ui, sans-serif !important;
  font-size: 14px !important;
}

/* === TOOLBAR FLOTTANT — MASQUÉ === */
.gjs-toolbar { display: none !important; }
.gjs-badge { display: none !important; }

/* === PANEL GAUCHE === */
.gjs-pn {
  width: 260px !important;
  min-width: 260px !important;
  max-width: 260px !important;
  height: 100% !important;
  padding: 0 !important;
  border-right: 1px solid rgba(123,92,255,0.09) !important;
  background: linear-gradient(180deg, #0b1428 0%, #091020 100%) !important;
  display: flex !important;
  flex-direction: column !important;
}
.gjs-pn-left, .gjs-pn-panel {
  width: 260px !important;
  min-width: 260px !important;
  max-width: 260px !important;
  padding: 0 !important;
  background: transparent !important;
}

/* === BOUTONS DE NAVIGATION === */
.gjs-pn-commands, .gjs-pn-buttons {
  display: flex !important;
  flex-direction: row !important;
  gap: 4px !important;
  padding: 12px 12px 10px !important;
  border-bottom: 1px solid rgba(123,92,255,0.07) !important;
}
.gjs-pn-btn {
  flex: 1 !important;
  height: 34px !important;
  width: auto !important;
  font-size: 10px !important;
  font-weight: 700 !important;
  letter-spacing: 0.04em !important;
  text-transform: uppercase !important;
  margin: 0 !important;
  padding: 0 8px !important;
  line-height: 34px !important;
  border-radius: 9px !important;
  background: transparent !important;
  border: 1px solid transparent !important;
  color: #564e78 !important;
  transition: all 0.15s ease !important;
}
.gjs-pn-btn:hover {
  background: rgba(255,255,255,0.04) !important;
  color: #7a7498 !important;
}
.gjs-pn-btn.active, .gjs-pn-btn.gjs-pn-active {
  background: rgba(123,92,255,0.13) !important;
  border-color: rgba(123,92,255,0.24) !important;
  color: #b09eff !important;
}
.gjs-pn-btn svg { width: 14px !important; height: 14px !important; }
.gjs-pn-title {
  font-size: 10px !important;
  padding: 14px 14px 7px !important;
  font-weight: 700 !important;
  color: rgba(123,92,255,0.5) !important;
  letter-spacing: 0.1em !important;
  text-transform: uppercase !important;
}

/* === BLOCS — GRILLE 2 COL COMPACTE === */
.gjs-block-container {
  display: grid !important;
  grid-template-columns: 1fr 1fr !important;
  gap: 8px !important;
  padding: 4px 12px 12px !important;
  width: 100% !important;
}
.gjs-block {
  width: 100% !important;
  padding: 16px 10px 12px !important;
  margin: 0 !important;
  border-radius: 12px !important;
  border: 1px solid rgba(123,92,255,0.09) !important;
  background: rgba(123,92,255,0.03) !important;
  cursor: grab !important;
  transition: all 0.2s cubic-bezier(0.4,0,0.2,1) !important;
  min-height: 88px !important;
  display: flex !important;
  flex-direction: column !important;
  align-items: center !important;
  justify-content: center !important;
  gap: 9px !important;
  box-sizing: border-box !important;
}
.gjs-block:hover {
  background: rgba(123,92,255,0.11) !important;
  border-color: rgba(123,92,255,0.28) !important;
  transform: translateY(-2px) !important;
  box-shadow: 0 8px 24px rgba(123,92,255,0.12) !important;
}
.gjs-block:active { transform: scale(0.97) !important; }

/* Icône dans un badge pill */
.gjs-block__media {
  width: 36px !important;
  height: 36px !important;
  font-size: 18px !important;
  line-height: 36px !important;
  text-align: center !important;
  background: rgba(123,92,255,0.1) !important;
  border: 1px solid rgba(123,92,255,0.18) !important;
  border-radius: 9px !important;
  color: #8b6cff !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}
.gjs-block svg {
  width: 18px !important;
  height: 18px !important;
  color: #8b6cff !important;
}
.gjs-block__label {
  font-size: 11px !important;
  font-weight: 600 !important;
  text-align: center !important;
  color: #8d89ae !important;
  letter-spacing: 0.01em !important;
  line-height: 1.3 !important;
}
.gjs-category-title, .gjs-category-label {
  font-size: 10px !important;
  padding: 14px 14px 7px !important;
  font-weight: 700 !important;
  color: rgba(123,92,255,0.5) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
}

/* === CANVAS — GRILLE POINTS === */
.gjs-cv-canvas {
  background-color: #060e1c !important;
  background-image: radial-gradient(rgba(123,92,255,0.07) 1px, transparent 1px) !important;
  background-size: 28px 28px !important;
}

/* === LAYERS === */
.gjs-layer {
  padding: 10px 12px !important;
  min-height: 40px !important;
  font-size: 13px !important;
  border-radius: 8px !important;
  margin: 2px 0 !important;
  transition: background 0.15s !important;
}
.gjs-layer:hover { background: rgba(123,92,255,0.07) !important; }
.gjs-layer-name { font-size: 13px !important; color: #a09cc0 !important; }

/* === STYLE MANAGER === */
.gjs-sm-sector-title {
  font-size: 10px !important;
  padding: 12px 14px 8px !important;
  font-weight: 700 !important;
  color: rgba(123,92,255,0.5) !important;
  text-transform: uppercase !important;
  letter-spacing: 0.1em !important;
}
.gjs-sm-property { padding: 8px 12px !important; }
.gjs-field input, .gjs-field select, .gjs-field textarea {
  font-size: 13px !important;
  padding: 7px 12px !important;
  height: 36px !important;
  border-radius: 9px !important;
  background: rgba(7,16,31,0.7) !important;
  border: 1px solid rgba(123,92,255,0.13) !important;
  color: #d4d0e0 !important;
  transition: border-color 0.15s !important;
}
.gjs-field input:focus, .gjs-field select:focus {
  border-color: rgba(123,92,255,0.4) !important;
  outline: none !important;
}

/* === TRAIT MANAGER === */
.gjs-trt-trait { padding: 8px 12px !important; }
.gjs-trt-label { font-size: 12px !important; color: #8d89ae !important; }

/* === SÉLECTION === */
.gjs-selected {
  outline: 2px solid #7B5CFF !important;
  outline-offset: 1px !important;
}

/* === SCROLLBARS === */
.gjs-pn-panel::-webkit-scrollbar,
.gjs-blocks::-webkit-scrollbar,
.gjs-layers::-webkit-scrollbar { width: 4px !important; }
.gjs-pn-panel::-webkit-scrollbar-thumb,
.gjs-blocks::-webkit-scrollbar-thumb,
.gjs-layers::-webkit-scrollbar-thumb {
  background: rgba(123,92,255,0.25) !important;
  border-radius: 2px !important;
}
.gjs-pn-panel::-webkit-scrollbar-track { background: transparent !important; }

/* === COULEURS NYXIA === */
.gjs-one-bg { background-color: #0b1428 !important; }
.gjs-two-color { color: #c4bde0 !important; }
.gjs-three-bg { background-color: #091020 !important; }
.gjs-four-color, .gjs-four-color-h:hover { color: #8b6cff !important; }

/* === BRANDING MASQUÉ === */
.gjs-logo, .gjs-logo-content, .gjs-brand,
.gjs-off-prv, .gjs-no-ph,
[title*="GrapesJS"], [aria-label*="GrapesJS"] { display: none !important; }
`

export default function GrapesJSEditorComponent({
  formationId,
  initialHtml = '',
  initialCss = '',
  initialComponents = '[]',
  initialStyles = '{}',
  onSave,
  onClose,
}: GrapesJSEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editorInstance = useRef<GrapesJSEditor>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    let isMounted = true
    let themeEl: HTMLStyleElement | null = null

    async function initEditor() {
      try {
        const grapesjs = (await import('grapesjs')).default
        const grapesjsBlocksBasic = (await import('grapesjs-blocks-basic')).default
        const grapesjsPresetWebpage = (await import('grapesjs-preset-webpage')).default
        const grapesjsCustomCode = (await import('grapesjs-custom-code')).default
        const grapesjsPluginForms = (await import('grapesjs-plugin-forms')).default

        if (!isMounted || !editorRef.current) return

        let parsedComponents
        try { parsedComponents = JSON.parse(initialComponents) } catch { parsedComponents = undefined }

        let parsedStyles
        try { parsedStyles = JSON.parse(initialStyles) } catch { parsedStyles = undefined }

        editorRef.current.id = 'nyxia-gjs-editor'

        const editor = grapesjs.init({
          container: editorRef.current,
          height: '100%',
          width: 'auto',
          fromElement: false,
          storageManager: false,
          plugins: [
            grapesjsBlocksBasic,
            grapesjsPresetWebpage,
            grapesjsCustomCode,
            grapesjsPluginForms,
          ],
          pluginsOpts: {
            [grapesjsPresetWebpage as unknown as string]: {
              modalImportTitle: 'Importer',
              modalImportLabel: 'Collez votre HTML/CSS ici',
              modalImportContent: '',
            },
            [grapesjsCustomCode as unknown as string]: {
              modalTitle: 'Code personnalisé',
            },
          },
          canvas: { styles: initialCss || undefined },
          components: parsedComponents || initialHtml || `
            <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#06101f;">
              <div style="text-align:center;max-width:600px;padding:40px;">
                <h1 style="font-family:'Cormorant Garamond',serif;font-size:42px;color:#fff;margin-bottom:16px;font-weight:300;">
                  Votre Page de Vente
                </h1>
                <p style="font-family:'Outfit',sans-serif;font-size:16px;color:rgba(255,255,255,0.6);line-height:1.7;">
                  Glissez des blocs depuis le panneau de gauche pour construire votre page.
                </p>
              </div>
            </div>
          `,
          style: parsedStyles || undefined,
        })

        editorInstance.current = editor

        // Inject premium theme CSS
        themeEl = document.createElement('style')
        themeEl.textContent = NYXIA_PREMIUM_CSS
        document.head.appendChild(themeEl)

        const setupTheme = () => {
          if (!editorRef.current) return
          const gjsEditor = editorRef.current.querySelector('.gjs-editor') || editorRef.current

          // Masquer le branding
          gjsEditor.querySelectorAll(
            '.gjs-off-prv, .gjs-no-ph, [class*="gjs-logo"], .gjs-brand, .gjs-logo, .gjs-logo-content, .gjs-badge'
          ).forEach(el => { (el as HTMLElement).style.display = 'none' })

          gjsEditor.querySelectorAll(
            '[title*="GrapesJS"], [title*="grapesjs"], [aria-label*="GrapesJS"], [aria-label*="grapesjs"]'
          ).forEach(el => { (el as HTMLElement).style.display = 'none' })

          // Forcer la grille 2 colonnes sur les blocs
          gjsEditor.querySelectorAll('.gjs-block-container').forEach((container) => {
            const el = container as HTMLElement
            el.style.display = 'grid'
            el.style.gridTemplateColumns = '1fr 1fr'
            el.style.gap = '8px'
            el.style.padding = '4px 12px 12px'
            el.style.width = '100%'
          })
        }

        ;[100, 300, 600, 1000, 2000].forEach(delay => setTimeout(setupTheme, delay))

        editor.on('load', () => {
          ;[100, 500, 1000].forEach(delay => setTimeout(setupTheme, delay))
        })

        if (isMounted) setIsLoading(false)
      } catch (error) {
        console.error('Editor init error:', error)
        if (isMounted) {
          setIsLoading(false)
          toast.error("Erreur lors du chargement de l'éditeur")
        }
      }
    }

    initEditor()

    return () => {
      isMounted = false
      if (themeEl) themeEl.remove()
      if (editorInstance.current) {
        try { editorInstance.current.destroy() } catch { /* ignore */ }
        editorInstance.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = useCallback(async () => {
    if (!editorInstance.current) return
    setIsSaving(true)
    try {
      const html = editorInstance.current.getHtml()
      const css = editorInstance.current.getCss()
      const components = JSON.stringify(editorInstance.current.getComponents())
      const styles = JSON.stringify(editorInstance.current.getStyle())

      const response = await fetch(`/api/formations/${formationId}/page`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ html_content: html, css_content: css, components_json: components, style_json: styles }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error)
      if (onSave) onSave({ html_content: html, css_content: css, components_json: components, style_json: styles })
      toast.success('Page sauvegardée avec succès !')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erreur de sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }, [formationId, onSave])

  const handlePreview = useCallback(() => {
    if (!editorInstance.current) return
    const html = editorInstance.current.getHtml()
    const css = editorInstance.current.getCss()
    const w = window.open('', '_blank')
    if (w) {
      w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><style>*{margin:0;padding:0;box-sizing:border-box;}body{background:#06101f;}</style></head><body>${html}</body></html>`)
      w.document.close()
    }
  }, [])

  return (
    <div className="fixed inset-0 z-[100] bg-[#06101f] flex flex-col">

      {/* TOP BAR */}
      <div className="flex items-center justify-between px-5 h-[58px] border-b border-purple-500/10 bg-[#0b1428]/95 backdrop-blur-sm shrink-0">

        {/* Gauche — logo + titre + badge */}
        <div className="flex items-center gap-3">
          <div
            className="w-[34px] h-[34px] rounded-[10px] flex items-center justify-center font-bold text-[14px] text-white"
            style={{
              background: 'linear-gradient(135deg, #8b6cff 0%, #5a3dd6 100%)',
              boxShadow: '0 4px 16px rgba(123,92,255,0.35), inset 0 1px 0 rgba(255,255,255,0.15)',
            }}
          >
            N
          </div>
          <span className="text-[#e8e2f8] font-semibold text-[14px] tracking-wide">
            Éditeur de Page
          </span>
          <span className="px-[9px] py-[3px] rounded-[6px] bg-purple-500/10 border border-purple-500/20 text-[10px] font-bold uppercase tracking-[0.05em] text-purple-400">
            Pro
          </span>
        </div>

        {/* Droite — actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={handlePreview}
            className="flex items-center gap-[7px] px-4 h-[36px] rounded-[10px] text-[13px] font-medium text-[#b4aecf] border border-white/[0.07] bg-white/[0.02] hover:bg-white/[0.06] hover:text-[#e8e2f8] hover:border-white/[0.12] transition-all"
          >
            <Eye className="w-[14px] h-[14px]" />
            Aperçu
          </button>

          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center gap-[7px] px-5 h-[36px] rounded-[10px] text-[13px] font-semibold text-white border border-purple-400/40 transition-all disabled:opacity-50 hover:-translate-y-px"
            style={{
              background: 'linear-gradient(135deg, rgba(123,92,255,0.9) 0%, rgba(90,61,214,0.9) 100%)',
              boxShadow: '0 4px 18px rgba(123,92,255,0.28), inset 0 1px 0 rgba(255,255,255,0.12)',
            }}
          >
            {isSaving
              ? <Loader2 className="w-[14px] h-[14px] animate-spin" />
              : <Save className="w-[14px] h-[14px]" />
            }
            Sauvegarder
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center w-[36px] h-[36px] rounded-[9px] text-[#5c5880] border border-white/[0.05] hover:bg-white/[0.05] hover:text-[#a09cc0] transition-all"
            >
              <X className="w-[15px] h-[15px]" />
            </button>
          )}
        </div>
      </div>

      {/* ZONE ÉDITEUR */}
      <div className="flex-1 relative overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#06101f]">
            <div className="text-center">
              <div
                className="w-9 h-9 rounded-full border-2 border-t-purple-500 animate-spin mx-auto mb-3"
                style={{ borderColor: 'rgba(123,92,255,0.2)', borderTopColor: '#7B5CFF' }}
              />
              <p className="text-[#564e78] text-[13px] font-medium tracking-wide">
                Chargement de l&apos;éditeur…
              </p>
            </div>
          </div>
        )}
        <div ref={editorRef} className="w-full h-full" />
      </div>
    </div>
  )
}
