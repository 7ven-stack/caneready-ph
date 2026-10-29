import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';

export function sendToTerminal(level, source, message, details = null) {
  const payload = {
    level,
    source,
    time: new Date().toLocaleTimeString(),
    message: String(message || ''),
    details: details ? String(details) : null,
  };

  try {
    fetch('/__terminal_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

function getLocalTagChildren(parentNode, localName) {
  if (!parentNode || !parentNode.children) return [];
  const target = localName.toLowerCase();
  return Array.from(parentNode.children).filter(
    (el) =>
      (el.localName || el.tagName || '').toLowerCase().replace(/^.*:/, '') ===
      target
  );
}

function getAllByLocalTag(rootNode, localName) {
  if (!rootNode || !rootNode.getElementsByTagName) return [];
  const direct = Array.from(rootNode.getElementsByTagName(localName));
  if (direct.length > 0) return direct;
  const all = Array.from(rootNode.getElementsByTagName('*'));
  const target = localName.toLowerCase();
  return all.filter(
    (el) =>
      (el.localName || el.tagName || '').toLowerCase().replace(/^.*:/, '') ===
      target
  );
}

function inspectKmlLayers(kmlText, fileName) {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
  const parserErrors = xmlDoc.getElementsByTagName('parsererror');
  if (parserErrors.length > 0) {
    return {
      error: `XML Parse Error in "${fileName}"`,
      details: parserErrors[0].textContent || 'Invalid XML structure',
      layers: [],
    };
  }

  const folders = getAllByLocalTag(xmlDoc, 'Folder');
  const allPlacemarks = getAllByLocalTag(xmlDoc, 'Placemark');
  sendToTerminal(
    'INFO',
    'KML-XML-DOM',
    `Detected ${folders.length} <Folder> element(s) and ${allPlacemarks.length} <Placemark> element(s).`
  );

  const items = [];

  if (folders.length > 0) {
    folders.forEach((folder, idx) => {
      const nameEl = getLocalTagChildren(folder, 'name')[0];
      const folderName = nameEl?.textContent?.trim() || `Layer ${idx + 1}`;
      const childFolders = getLocalTagChildren(folder, 'Folder');
      const directPlacemarks = getLocalTagChildren(folder, 'Placemark');
      const allNestedPlacemarks = getAllByLocalTag(folder, 'Placemark');

      // Find parent folder name (e.g. "OCTOBER 23" -> "=KIEROWYN") so duplicate sub-folder names are easy to distinguish
      let parentFolderName = '';
      if (
        folder.parentNode &&
        (folder.parentNode.localName || folder.parentNode.tagName || '')
          .toLowerCase()
          .endsWith('folder')
      ) {
        parentFolderName =
          getLocalTagChildren(folder.parentNode, 'name')[0]?.textContent?.trim() ||
          '';
      }

      const targetPlacemarks =
        childFolders.length > 0 ? directPlacemarks : allNestedPlacemarks;

      let polygonCount = 0;
      let hasZ = false;

      targetPlacemarks.forEach((pm) => {
        const polys = getAllByLocalTag(pm, 'Polygon');
        if (polys.length > 0) {
          polygonCount += polys.length;
          const coordNodes = getAllByLocalTag(pm, 'coordinates');
          const sampleCoord =
            coordNodes[0]?.textContent?.trim().split(/\s+/)[0] || '';
          if (sampleCoord.split(',').length >= 3) {
            hasZ = true;
          }
        }
      });

      const count = polygonCount > 0 ? polygonCount : targetPlacemarks.length;
      const geomType =
        polygonCount > 0
          ? hasZ
            ? 'PolygonZ'
            : 'Polygon'
          : count > 0
          ? 'Geometry'
          : 'Unknown';

      items.push({
        id: `folder-${idx}`,
        folderIndex: idx,
        name: folderName,
        parentName: parentFolderName,
        displayName:
          parentFolderName && count > 0
            ? `${folderName}  —  [${parentFolderName}]`
            : folderName,
        count,
        geomType,
        description: `${geomType} (${count})`,
        isEmpty: count === 0,
      });
    });
  } else {
    const docNode = getAllByLocalTag(xmlDoc, 'Document')[0];
    const docName =
      getLocalTagChildren(docNode, 'name')[0]?.textContent?.trim() ||
      fileName.replace(/\.kml$/i, '');

    items.push({
      id: 'doc-root',
      folderIndex: -1,
      name: docName,
      parentName: '',
      displayName: docName,
      count: allPlacemarks.length,
      geomType: allPlacemarks.length > 0 ? 'PolygonZ' : 'Unknown',
      description: `${
        allPlacemarks.length > 0 ? 'PolygonZ' : 'Unknown'
      } (${allPlacemarks.length})`,
      isEmpty: allPlacemarks.length === 0,
    });
  }

  return { error: null, details: null, layers: items };
}

function buildFilteredKmlXml(kmlText, selectedFolderIndicesSet) {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
    const folders = getAllByLocalTag(xmlDoc, 'Folder');

    if (folders.length === 0 || selectedFolderIndicesSet.has(-1)) {
      return kmlText;
    }

    // Create a clean KML Document containing ONLY the selected Folder clones
    const newKmlDoc = parser.parseFromString(
      '<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document></Document></kml>',
      'text/xml'
    );
    const targetDocNode = newKmlDoc.getElementsByTagName('Document')[0];

    // Copy over shared <Style> and <StyleMap> definitions so polygon colors remain intact
    const styles = [
      ...getAllByLocalTag(xmlDoc, 'Style'),
      ...getAllByLocalTag(xmlDoc, 'StyleMap'),
    ];
    styles.forEach((styleNode) => {
      if (
        styleNode.parentNode &&
        (styleNode.parentNode.localName || styleNode.parentNode.tagName || '')
          .toLowerCase()
          .endsWith('document')
      ) {
        targetDocNode.appendChild(newKmlDoc.importNode(styleNode, true));
      }
    });

    folders.forEach((folder, idx) => {
      if (selectedFolderIndicesSet.has(idx)) {
        const clonedFolder = newKmlDoc.importNode(folder, true);
        // Strip nested sub-folders from the clone if it's a parent container so we only import what was explicitly checked
        const nestedSubFolders = getLocalTagChildren(clonedFolder, 'Folder');
        nestedSubFolders.forEach((sf) => {
          if (sf.parentNode === clonedFolder) {
            clonedFolder.removeChild(sf);
          }
        });
        targetDocNode.appendChild(clonedFolder);
      }
    });

    return new XMLSerializer().serializeToString(newKmlDoc);
  } catch (err) {
    sendToTerminal('ERROR', 'KML-Filter', err.message, err.stack);
    return kmlText;
  }
}

function StandaloneKmlSelectorApp() {
  const [pendingKml, setPendingKml] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showEmptyLayers, setShowEmptyLayers] = useState(true);
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    window.__openCaneReadyKmlModal = (data) => {
      setPendingKml(data);
      setSearchTerm('');
      const nonEmpty = (data?.layers || []).filter((l) => !l.isEmpty);
      // If file has many layers (> 15, like RSSI MAPPING with 229 layers), start with 0 selected so user can pick specific ones
      if (nonEmpty.length > 15) {
        setSelectedIds([]);
      } else {
        setSelectedIds(nonEmpty.map((l) => l.id));
      }
      sendToTerminal(
        'INFO',
        'KML-Modal-Mounted',
        `Displayed KML Layer Selector Modal on screen for "${data?.fileName}" (${data?.layers?.length || 0} layers).`
      );
    };
    return () => {
      delete window.__openCaneReadyKmlModal;
    };
  }, []);

  const visibleLayers = useMemo(() => {
    if (!pendingKml?.layers) return [];
    return pendingKml.layers.filter((layer) => {
      if (!showEmptyLayers && layer.isEmpty) return false;
      if (!searchTerm.trim()) return true;
      const q = searchTerm.toLowerCase();
      return (
        layer.displayName.toLowerCase().includes(q) ||
        layer.name.toLowerCase().includes(q) ||
        layer.description.toLowerCase().includes(q)
      );
    });
  }, [pendingKml, showEmptyLayers, searchTerm]);

  if (!pendingKml) return null;

  const toggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleCancel = () => {
    sendToTerminal('WARN', 'KML-Selector', 'User closed KML Layer Selector.');
    if (pendingKml.inputElement) {
      pendingKml.inputElement.value = '';
    }
    setPendingKml(null);
  };

  const handleConfirm = () => {
    try {
      const chosenLayers = pendingKml.layers.filter((l) =>
        selectedIds.includes(l.id)
      );
      if (chosenLayers.length === 0) return;

      const chosenIndices = new Set(chosenLayers.map((l) => l.folderIndex));
      const filteredXml = buildFilteredKmlXml(
        pendingKml.rawText,
        chosenIndices
      );

      const inputEl =
        pendingKml.inputElement ||
        document.querySelector('input[type="file"]');
      const fileName = pendingKml.fileName;

      setPendingKml(null);

      sendToTerminal(
        'INFO',
        'KML-Confirm',
        `Adding ${chosenLayers.length} selected layer(s) (${chosenLayers
          .reduce((s, l) => s + l.count, 0)} polygons): ${chosenLayers
          .map((l) => l.displayName)
          .join(', ')}`
      );

      if (!inputEl) {
        sendToTerminal(
          'ERROR',
          'KML-Dispatch',
          'Could not locate <input type="file"> element on page.'
        );
        return;
      }

      const filteredFile = new File([filteredXml], fileName, {
        type: 'application/vnd.google-earth.kml+xml',
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(filteredFile);

      window.__bypassCaneReadyKmlIntercept = true;
      inputEl.files = dataTransfer.files;
      inputEl.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      sendToTerminal('ERROR', 'KML-Confirm-Error', err.message, err.stack);
    }
  };

  const totalSelectedPolygons = pendingKml.layers
    .filter((l) => selectedIds.includes(l.id))
    .reduce((sum, l) => sum + (l.count || 0), 0);

  return (
    <div
      style={{ zIndex: 999999 }}
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4 select-none"
    >
      <div className="bg-[#1e1e1e] text-slate-100 rounded-xl max-w-xl w-full border border-slate-600 shadow-2xl overflow-hidden font-sans">
        {/* Top QGIS Window Bar */}
        <div className="px-4 py-3 bg-[#252526] border-b border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="w-5 h-5 rounded-full bg-emerald-600 text-white font-extrabold text-[11px] flex items-center justify-center shrink-0">
              Q
            </span>
            <h3 className="text-xs sm:text-sm font-bold text-white truncate">
              Select Items to Add | {pendingKml.fileName.replace(/\.kml$/i, '')}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-sky-400 underline truncate">
              {pendingKml.fileName}
            </span>
            <span className="text-[11px] font-mono text-slate-400 shrink-0">
              {pendingKml.layers.length} total folders
            </span>
          </div>

          {/* Search Box */}
          <input
            type="text"
            autoFocus
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search folder, planter, date (e.g. Kierowyn, Rafael, October 24)..."
            className="w-full px-3 py-2 rounded bg-[#141414] border border-slate-700 text-slate-100 placeholder:text-slate-500 text-xs focus:outline-none focus:border-emerald-500"
          />

          {/* Item / Description Table */}
          <div className="border border-slate-700 rounded bg-[#141414] h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 z-10 bg-[#252526] text-slate-300 border-b border-slate-700 text-[11px]">
                <tr>
                  <th className="py-1.5 px-3 border-r border-slate-700 font-semibold w-2/3">
                    Item
                  </th>
                  <th className="py-1.5 px-3 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {visibleLayers.map((layer) => {
                  const isSelected = selectedIds.includes(layer.id);
                  return (
                    <tr
                      key={layer.id}
                      onClick={() => toggleRow(layer.id)}
                      className={
                        'cursor-pointer transition-colors ' +
                        (isSelected
                          ? 'bg-emerald-600/35 text-white'
                          : layer.isEmpty
                          ? 'text-slate-400 hover:bg-slate-800/60 font-bold bg-[#1a1a1c]'
                          : 'hover:bg-slate-800/70 text-slate-200')
                      }
                    >
                      <td className="py-1.5 px-3 flex items-center gap-2 truncate">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded border-slate-600 text-emerald-500 focus:ring-0 cursor-pointer shrink-0"
                        />
                        {!layer.isEmpty ? (
                          <span className="text-emerald-400 text-[11px] shrink-0">
                            ⬢
                          </span>
                        ) : (
                          <span className="text-amber-400 text-[11px] shrink-0">
                            📁
                          </span>
                        )}
                        <span className="truncate">{layer.displayName}</span>
                      </td>
                      <td className="py-1.5 px-3 font-mono text-[11px] text-slate-300 whitespace-nowrap">
                        {layer.description}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Select All / Deselect All Controls */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  visibleLayers.filter((l) => !l.isEmpty).map((l) => l.id)
                )
              }
              className="px-3 py-1 rounded bg-[#2d2d30] hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
            >
              Select All Visible
            </button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="px-3 py-1 rounded bg-[#2d2d30] hover:bg-slate-700 border border-slate-600 text-slate-200 font-medium text-xs transition-colors cursor-pointer"
            >
              Deselect All
            </button>
            <span className="ml-auto text-[11px] text-emerald-400 font-mono font-semibold">
              {selectedIds.length} folder(s) • {totalSelectedPolygons} polygons
            </span>
          </div>

          {/* Options */}
          <div className="pt-2 border-t border-slate-800 space-y-1.5">
            <div className="text-[11px] font-bold text-slate-300">Options</div>
            <label className="flex items-center gap-2 text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={showEmptyLayers}
                onChange={(e) => setShowEmptyLayers(e.target.checked)}
                className="rounded border-slate-600 text-emerald-500 focus:ring-0"
              />
              <span>Show empty vector layers (Date headers / groups)</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#252526] border-t border-slate-700 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={handleConfirm}
            className="px-4 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold transition-colors cursor-pointer"
          >
            Add Layers ({selectedIds.length})
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-1.5 rounded bg-[#2d2d30] hover:bg-slate-700 border border-slate-600 text-slate-200 font-semibold transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

let isInstalled = false;

export function installTerminalErrorForwarder() {
  if (isInstalled || typeof window === 'undefined') return;
  isInstalled = true;

  sendToTerminal(
    'INFO',
    'AppBoot',
    'Browser-to-Antigravity Terminal Error Forwarder & KML Selector active.'
  );

  // Mount the standalone KML Selector Root directly onto document.body
  const mountModalHost = () => {
    let host = document.getElementById('caneready-kml-modal-root');
    if (!host) {
      host = document.createElement('div');
      host.id = 'caneready-kml-modal-root';
      document.body.appendChild(host);
      const root = createRoot(host);
      root.render(<StandaloneKmlSelectorApp />);
    }
  };

  if (document.body) {
    mountModalHost();
  } else {
    window.addEventListener('DOMContentLoaded', mountModalHost);
  }

  // Global KML File Input Capture Listener
  document.addEventListener(
    'change',
    (e) => {
      const target = e.target;
      if (!target || target.tagName !== 'INPUT' || target.type !== 'file')
        return;

      if (window.__bypassCaneReadyKmlIntercept) {
        window.__bypassCaneReadyKmlIntercept = false;
        sendToTerminal(
          'INFO',
          'KML-Import',
          'Forwarding filtered KML XML to map parser...'
        );
        return;
      }

      const file = target.files && target.files[0];
      if (!file) return;

      sendToTerminal(
        'INFO',
        'KML-Input',
        `Intercepted KML file "${file.name}" (${(file.size / 1024).toFixed(
          1
        )} KB)`
      );

      e.stopPropagation();
      if (typeof e.stopImmediatePropagation === 'function') {
        e.stopImmediatePropagation();
      }

      const reader = new FileReader();
      reader.onerror = (err) => {
        sendToTerminal(
          'ERROR',
          'KML-FileReader',
          `Failed reading "${file.name}"`,
          String(err)
        );
      };
      reader.onload = (loadEvt) => {
        try {
          const rawXml = String(loadEvt.target?.result || '');
          const parsedResult = inspectKmlLayers(rawXml, file.name);
          if (parsedResult.error) {
            sendToTerminal(
              'ERROR',
              'KML-Parser',
              parsedResult.error,
              parsedResult.details
            );
            return;
          }

          mountModalHost();
          if (typeof window.__openCaneReadyKmlModal === 'function') {
            window.__openCaneReadyKmlModal({
              fileName: file.name,
              rawText: rawXml,
              layers: parsedResult.layers,
              inputElement: target,
            });
          } else {
            sendToTerminal(
              'ERROR',
              'KML-Modal',
              'Modal host was not ready on window.__openCaneReadyKmlModal'
            );
          }
        } catch (err) {
          sendToTerminal('ERROR', 'KML-OnLoad', err.message, err.stack);
        }
      };
      reader.readAsText(file);
    },
    true
  );

  window.addEventListener('error', (event) => {
    sendToTerminal(
      'ERROR',
      'WindowError',
      event.message || 'Uncaught runtime error',
      `${event.filename || ''}:${event.lineno || ''}:${event.colno || ''}\n${
        event.error?.stack || ''
      }`
    );
  });

  window.addEventListener('unhandledrejection', (event) => {
    sendToTerminal(
      'ERROR',
      'UnhandledPromise',
      event.reason?.message || String(event.reason || 'Promise rejected'),
      event.reason?.stack || null
    );
  });

  const origConsoleError = console.error;
  console.error = (...args) => {
    origConsoleError.apply(console, args);
    const text = args
      .map((a) =>
        a instanceof Error
          ? `${a.message}\n${a.stack}`
          : typeof a === 'object'
          ? JSON.stringify(a)
          : String(a)
      )
      .join(' ');
    sendToTerminal('ERROR', 'console.error', text);
  };
}
