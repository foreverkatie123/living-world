'use client'

import { useState, useEffect, useRef } from 'react'
import { Plus, X, Eye, EyeOff, Lock, Trash2, Upload, ImageOff } from 'lucide-react'
import type { Campaign, MapPin as MapPinType } from '@/types'

interface Props {
  campaign: Campaign
  initialPins: MapPinType[]
  role: 'dm' | 'player'
}

const PIN_COLORS: Record<string, string> = {
  city:     '#f59e0b',
  town:     '#84cc16',
  dungeon:  '#ef4444',
  landmark: '#8b5cf6',
  hidden:   '#6b7280',
  party:    '#06b6d4',
}

const PIN_ICONS: Record<string, string> = {
  city:     '🏰',
  town:     '🏘',
  dungeon:  '💀',
  landmark: '⚑',
  hidden:   '?',
  party:    '⚔',
}

export default function MapClient({ campaign, initialPins, role }: Props) {
  const mapRef       = useRef<any>(null)
  const leafletRef   = useRef<any>(null)
  const mapElRef     = useRef<HTMLDivElement>(null)
  const overlayRef   = useRef<any>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [pins, setPins]               = useState<MapPinType[]>(initialPins)
  const [selected, setSelected]       = useState<MapPinType | null>(null)
  const [adding, setAdding]           = useState(false)
  const [newPin, setNewPin]           = useState<any>(null)
  const [saving, setSaving]           = useState(false)
  const [mapImageUrl, setMapImageUrl] = useState<string | null>(campaign.map_image_url)
  const [uploading, setUploading]     = useState(false)
  const [showUploadPanel, setShowUploadPanel] = useState(false)

  const isDM = role === 'dm'

  function initMap(L: any, imageUrl: string | null) {
    if (mapRef.current) {
      mapRef.current.remove()
      mapRef.current = null
    }

    let map: any

    if (imageUrl) {
      // Use Simple CRS for custom fantasy maps — image fills the whole map
      const img = new Image()
      img.onload = () => {
        if (mapRef.current) return
        const w = img.naturalWidth
        const h = img.naturalHeight
        const bounds: any = [[-h, 0], [0, w]]  // negative y, so [0,0] is top-left

        map = L.map(mapElRef.current!, {
          crs: L.CRS.Simple,
          zoomControl: false,
          minZoom: -2,
          maxZoom: 4,
        })

        L.imageOverlay(imageUrl, bounds).addTo(map)
        map.fitBounds(bounds, { padding: [0, 0] })
        map.setMaxBounds(bounds)
        overlayRef.current = { bounds }
        mapRef.current = map
        leafletRef.current = L
        renderPins(L, map, pins, bounds)
        attachClickHandler(map)
        L.control.zoom({ position: 'bottomright' }).addTo(map)
      }
      img.src = imageUrl
    } else {
      // Real-world tile map
      map = L.map(mapElRef.current!, {
        center: [20, 0],
        zoom: 2,
        zoomControl: false,
        minZoom: 1,
      })

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        maxZoom: 19,
      }).addTo(map)

      mapRef.current = map
      leafletRef.current = L
      renderPins(L, map, pins, null)
      attachClickHandler(map)
      L.control.zoom({ position: 'bottomright' }).addTo(map)
    }
  }

  function renderPins(L: any, map: any, pinsToRender: MapPinType[], imageBounds: any) {
    ;(window as any).__lw_markers?.forEach((m: any) => m.remove())
    ;(window as any).__lw_markers = []

    const visiblePins = isDM ? pinsToRender : pinsToRender.filter(p => p.visible_to_players)

    visiblePins.forEach(pin => {
      let lat = pin.lat
      let lng = pin.lng

      if (imageBounds) {
        const h = -imageBounds[0][0]
        const w = imageBounds[1][1]
        lat = pin.lat * h   // fraction * current image height
        lng = pin.lng * w   // fraction * current image width
      }
      console.log('pin', pin.label, 'stored lat:', pin.lat, 'rendering at lat:', lat)
      const color = PIN_COLORS[pin.pin_type] ?? 'var(--city)'
      const icon  = PIN_ICONS[pin.pin_type]  ?? '•'

      const divIcon = L.divIcon({
        html: `<div style="
          background:${color};width:32px;height:32px;
          border-radius:50% 50% 50% 0;transform:rotate(-45deg);
          border:2px solid rgba(0,0,0,0.4);display:flex;
          align-items:center;justify-content:center;
          box-shadow:0 2px 8px rgba(0,0,0,0.5);">
          <span style="transform:rotate(45deg);font-size:14px;line-height:1">${icon}</span>
        </div>`,
        className: '',
        iconSize:   [32, 32],
        iconAnchor: [16, 32],
      })

      const marker = L.marker([lat, lng], { icon: divIcon })
        .addTo(map)
        .on('click', () => setSelected(pin))
      ;(window as any).__lw_markers.push(marker)
    })
  }

  function attachClickHandler(map: any) {
    map.on('click', (e: any) => {
      if (!(window as any).__lw_adding) return
      const bounds = overlayRef.current?.bounds
      const lat = e.latlng.lat
      const lng = e.latlng.lng
      setNewPin({
        lat,
        lng: e.latlng.lng,
        pin_type: 'city', label: '',
        visible_to_players: true,
        wealth_level: 50, stability: 50, trade_modifier: 0,
        reputation: {}, dm_notes: '', player_notes: '',
      })
      ;(window as any).__lw_adding = false
      setAdding(false)
    })
  }

  // Keep window flag in sync with adding state
  useEffect(() => {
    ;(window as any).__lw_adding = adding
  }, [adding])

  // Init map
  useEffect(() => {
    if (typeof window === 'undefined' || mapRef.current) return

    let cancelled = false

    import('leaflet').then(L => {
      if (mapRef.current) return
      initMap(L, mapImageUrl)
    })

    return () => {
      cancelled = true
      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
        leafletRef.current = null
        ;(window as any).__lw_markers = []
      }
    }
  }, [])

  // Re-render pins when they change
  useEffect(() => {
    const L = leafletRef.current
    const map = mapRef.current
    if (!L || !map) return
    renderPins(L, map, pins, overlayRef.current?.bounds ?? null)
  }, [pins, isDM])

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch(`/api/campaigns/${campaign.id}/map-image`, {
      method: 'POST',
      body: form,
    })
    const data = await res.json()

    if (res.ok) {
      setMapImageUrl(data.url)
      setShowUploadPanel(false)
      // Reinit map with new image
      import('leaflet').then(L => {
        leafletRef.current = L
        initMap(L, data.url)
      })
    }
    setUploading(false)
    e.target.value = ''
  }

  async function handleImageRemove() {
    await fetch(`/api/campaigns/${campaign.id}/map-image`, { method: 'DELETE' })
    setMapImageUrl(null)
    setShowUploadPanel(false)
    import('leaflet').then(L => {
      leafletRef.current = L
      initMap(L, null)
    })
  }

  async function savePin() {
    if (!newPin?.label?.trim()) return
    setSaving(true)
    function attachClickHandler(map: any) {
      map.on('click', (e: any) => {
        if (!(window as any).__lw_adding) return
        const bounds = overlayRef.current?.bounds
        if (!bounds) return // tile-map mode, handle separately if needed

        const h = -bounds[0][0]   // image height in px
        const w = bounds[1][1]    // image width in px
        const fracLat = e.latlng.lat / h   // -1..0
        const fracLng = e.latlng.lng / w   // 0..1

        setNewPin({
          lat: fracLat,
          lng: fracLng,
          pin_type: 'city', label: '',
          visible_to_players: true,
          wealth_level: 50, stability: 50, trade_modifier: 0,
          reputation: {}, dm_notes: '', player_notes: '',
        })
        ;(window as any).__lw_adding = false
        setAdding(false)
      })
    }
    const res = await fetch(`/api/campaigns/${campaign.id}/pins`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newPin),
    })
    if (res.ok) {
      const saved = await res.json()
      setPins(p => [...p, saved])
      setNewPin(null)
    }
    setSaving(false)
  }

  async function deletePin(pinId: string) {
    await fetch(`/api/campaigns/${campaign.id}/pins/${pinId}`, { method: 'DELETE' })
    setPins(p => p.filter(x => x.id !== pinId))
    setSelected(null)
  }

  async function toggleVisibility(pin: MapPinType) {
    const res = await fetch(`/api/campaigns/${campaign.id}/pins/${pin.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ visible_to_players: !pin.visible_to_players }),
    })
    if (res.ok) {
      setPins(p => p.map(x => x.id === pin.id ? { ...x, visible_to_players: !x.visible_to_players } : x))
      setSelected(s => s?.id === pin.id ? { ...s, visible_to_players: !s.visible_to_players } : s)
    }
  }

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-stone-900 border-b border-stone-800 shrink-0 z-10">
        <div>
          <span className="text-white text-sm font-medium">{campaign.name}</span>
          <span className="text-stone-500 text-xs ml-2">World map</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-3 mr-2">
            {Object.entries(PIN_COLORS).map(([type, color]) =>
              (type !== 'hidden' || isDM) ? (
                <span key={type} className="flex items-center gap-1 text-xs text-stone-400">
                  <span style={{ background: color }} className="w-2.5 h-2.5 rounded-full inline-block" />
                  {type}
                </span>
              ) : null
            )}
          </div>

          {isDM && (
            <>
              <button
                onClick={() => setShowUploadPanel(p => !p)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  showUploadPanel
                    ? 'bg-stone-700 text-white'
                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-white'
                }`}
              >
                <Upload size={13} />
                {mapImageUrl ? 'Change map' : 'Upload map'}
              </button>

              <button
                onClick={() => setAdding(a => !a)}
                className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-colors font-medium ${
                  adding
                    ? 'bg-amber-500 text-stone-950'
                    : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-white'
                }`}
              >
                <Plus size={13} />
                {adding ? 'Click map to place…' : 'Add pin'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden">
        {/* Map container */}
        <div ref={mapElRef} className="absolute inset-0" />

        {/* Upload panel */}
        {showUploadPanel && isDM && (
          <div className="absolute left-4 top-4 w-72 bg-stone-900 border border-stone-800 rounded-xl shadow-2xl z-20 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white text-sm font-medium">Map image</h3>
              <button onClick={() => setShowUploadPanel(false)} className="text-stone-500 hover:text-stone-300">
                <X size={14} />
              </button>
            </div>

            {mapImageUrl ? (
              <div className="space-y-3">
                <div className="rounded-lg overflow-hidden bg-stone-800 aspect-video">
                  <img src={mapImageUrl} alt="Current map" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="flex-1 bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <Upload size={12} /> Replace
                  </button>
                  <button
                    onClick={handleImageRemove}
                    className="flex-1 border border-red-900/50 text-red-400 hover:bg-red-950/30 text-xs rounded-lg py-2 transition-colors flex items-center justify-center gap-1.5"
                  >
                    <ImageOff size={12} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-stone-700 hover:border-amber-600 rounded-lg p-6 text-center cursor-pointer transition-colors group"
                >
                  <Upload size={20} className="mx-auto text-stone-600 group-hover:text-amber-500 mb-2 transition-colors" />
                  <p className="text-stone-400 text-xs">Click to upload your map image</p>
                  <p className="text-stone-600 text-xs mt-0.5">PNG, JPG, WEBP — any size</p>
                </div>
                <p className="text-stone-600 text-xs leading-relaxed">
                  Upload a fantasy map and it will replace the world map. Pins sit on top.
                </p>
                {uploading && <p className="text-amber-400 text-xs text-center">Uploading…</p>}
              </div>
            )}

            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
          </div>
        )}

        {/* Pin detail panel */}
        {selected && (
          <div className="absolute right-4 top-4 w-72 bg-stone-900 border border-stone-800 rounded-xl shadow-2xl z-20 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-stone-800">
              <div className="flex items-center gap-2">
                <span style={{ background: PIN_COLORS[selected.pin_type] }} className="w-3 h-3 rounded-full" />
                <span className="text-white font-medium text-sm">{selected.label}</span>
              </div>
              <div className="flex items-center gap-1">
                {isDM && (
                  <>
                    <button onClick={() => toggleVisibility(selected)} className="p-1.5 text-stone-500 hover:text-stone-300 rounded transition-colors">
                      {selected.visible_to_players ? <Eye size={14} /> : <EyeOff size={14} />}
                    </button>
                    <button onClick={() => deletePin(selected.id)} className="p-1.5 text-stone-500 hover:text-red-400 rounded transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
                <button onClick={() => setSelected(null)} className="p-1.5 text-stone-500 hover:text-stone-300 rounded transition-colors">
                  <X size={14} />
                </button>
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex gap-3 text-xs">
                <div className="flex-1 bg-stone-800 rounded-lg p-2 text-center">
                  <div className="text-stone-500 mb-0.5">Wealth</div>
                  <div className="text-amber-400 font-medium">{selected.wealth_level}</div>
                </div>
                <div className="flex-1 bg-stone-800 rounded-lg p-2 text-center">
                  <div className="text-stone-500 mb-0.5">Stability</div>
                  <div className="text-green-400 font-medium">{selected.stability}</div>
                </div>
                <div className="flex-1 bg-stone-800 rounded-lg p-2 text-center">
                  <div className="text-stone-500 mb-0.5">Trade</div>
                  <div className={`font-medium ${selected.trade_modifier >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                    {selected.trade_modifier >= 0 ? '+' : ''}{selected.trade_modifier}%
                  </div>
                </div>
              </div>
              {selected.player_notes && (
                <div>
                  <div className="text-stone-500 text-xs mb-1">Notes</div>
                  <p className="text-stone-300 text-xs leading-relaxed">{selected.player_notes}</p>
                </div>
              )}
              {isDM && selected.dm_notes && (
                <div className="bg-amber-950/30 border border-amber-900/40 rounded-lg p-2">
                  <div className="text-amber-600 text-xs mb-1">DM notes (hidden)</div>
                  <p className="text-amber-300/80 text-xs leading-relaxed">{selected.dm_notes}</p>
                </div>
              )}
              {!selected.visible_to_players && (
                <div className="flex items-center gap-1.5 text-xs text-stone-600">
                  <Lock size={11} /> Hidden from players
                </div>
              )}
            </div>
          </div>
        )}

        {/* New pin form */}
        {newPin && (
          <div className="absolute left-1/2 -translate-x-1/2 bottom-6 w-80 bg-stone-900 border border-stone-800 rounded-xl shadow-2xl z-20 p-4">
            <h3 className="text-white text-sm font-medium mb-3">New pin</h3>
            <div className="space-y-3">
              <input
                autoFocus
                value={newPin.label ?? ''}
                onChange={e => setNewPin((p: any) => ({ ...p, label: e.target.value }))}
                placeholder="Location name…"
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-white text-sm placeholder-stone-500 focus:outline-none focus:border-amber-500"
              />
              <div className="grid grid-cols-3 gap-2">
                {(['city','town','dungeon','landmark','hidden','party'] as const).map(type => (
                  <button
                    key={type}
                    onClick={() => setNewPin((p: any) => ({ ...p, pin_type: type }))}
                    className="py-1.5 rounded-lg text-xs font-medium transition-colors capitalize"
                    style={newPin.pin_type === type
                      ? { background: PIN_COLORS[type], color: 'var(--black)' }
                      : { background: 'var(--basicallyBlack)', color: 'var(--beige)' }
                    }
                  >
                    {PIN_ICONS[type]} {type}
                  </button>
                ))}
              </div>
              <input
                value={newPin.player_notes ?? ''}
                onChange={e => setNewPin((p: any) => ({ ...p, player_notes: e.target.value }))}
                placeholder="What players know…"
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500"
              />
              <input
                value={newPin.dm_notes ?? ''}
                onChange={e => setNewPin((p: any) => ({ ...p, dm_notes: e.target.value }))}
                placeholder="DM notes (hidden from players)…"
                className="w-full bg-stone-800 border border-stone-700 rounded-lg px-3 py-2 text-stone-300 text-xs placeholder-stone-600 focus:outline-none focus:border-amber-500"
              />
              <label className="flex items-center gap-2 text-xs text-stone-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={newPin.visible_to_players ?? true}
                  onChange={e => setNewPin((p: any) => ({ ...p, visible_to_players: e.target.checked }))}
                  className="accent-amber-500"
                />
                Visible to players
              </label>
              <div className="flex gap-2">
                <button onClick={() => setNewPin(null)} className="flex-1 border border-stone-700 text-stone-400 rounded-lg py-2 text-xs hover:bg-stone-800 transition-colors">
                  Cancel
                </button>
                <button
                  onClick={savePin}
                  disabled={saving || !newPin.label?.trim()}
                  className="flex-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-stone-950 font-medium rounded-lg py-2 text-xs transition-colors"
                >
                  {saving ? 'Saving…' : 'Place pin'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}