// --- DEFAULT DATA ---
const DEFAULTS = {
    cakes: [
        {"Type":"Pound Cake","Flour":1,"Sugar":1,"Fat":1.0,"Egg":1.0,"Liquid":0.0,"BP_Required":"False","Method":"Creaming","Fat_Prep":"Butter (Soft)","Sugar_Prep":"White Granulated"},
        {"Type":"Butter Cake","Flour":1,"Sugar":1,"Fat":0.5,"Egg":0.5,"Liquid":0.5,"BP_Required":"True","Method":"Creaming","Fat_Prep":"Butter (Soft)","Sugar_Prep":"White Granulated","Liquid_Prep":"Whole Milk"},
        {"Type":"Sponge (Genoise)","Flour":1,"Sugar":1,"Fat":0.0,"Egg":1.7,"Liquid":0.0,"BP_Required":"False","Method":"Foaming","Fat_Prep":"Butter (Melted)","Sugar_Prep":"Caster/Fine"},
        {"Type":"Fudgy Brownie","Flour":1,"Sugar":3,"Fat":2.0,"Egg":1.5,"Liquid":0.0,"BP_Required":"False","Method":"Melting","Fat_Prep":"Butter (Hot)","Sugar_Prep":"White Granulated"},
        {"Type":"Cakey Brownie","Flour":1,"Sugar":2,"Fat":1.0,"Egg":1.0,"Liquid":0.0,"BP_Required":"True","Method":"Creaming","Fat_Prep":"Butter (Soft)","Sugar_Prep":"White Granulated"}
    ],
    vessels: [
        {"Vessel Name":"Mug/Ramekin","Total Mass (g)":175,"Safety Warning":""},
        {"Vessel Name":"Muffin Tin (x6)","Total Mass (g)":350,"Safety Warning":"Use Silicone Liners"},
        {"Vessel Name":"20cm Round Pan","Total Mass (g)":750,"Safety Warning":"Tent with foil after 20m"}
    ],
    inclusions: [
        {"Class":"Heavy/Dry (Chips/Nuts)","Max %":0.25,"Prep Instruction":"Toss in 1 tsp flour"},
        {"Class":"Heavy/Wet (Berries)","Max %":0.2,"Prep Instruction":"Toss in 1 tsp flour. Do NOT thaw."},
        {"Class":"Swirl (Jam/PB)","Max %":0.15,"Prep Instruction":"Dollop on top and swirl."},
        {"Class":"Light (Sprinkles)","Max %":0.1,"Prep Instruction":"Fold gently at end."}
    ]
};

let db = { cakes: [], vessels: [], inclusions: [] };

window.addEventListener('DOMContentLoaded', () => {
    loadData();
    populateUI();
    setupModal();
    generateSettingsUI();
});

function loadData() {
    ['cakes', 'vessels', 'inclusions'].forEach(key => {
        const stored = localStorage.getItem(`ratio_${key}`);
        db[key] = stored ? JSON.parse(stored) : JSON.parse(JSON.stringify(DEFAULTS[key]));
    });
}

function saveData(key, data) {
    db[key] = data;
    localStorage.setItem(`ratio_${key}`, JSON.stringify(data));
    populateUI();
    document.getElementById('settingsModal').style.display = 'none';
}

function resetData(key) {
    if(confirm(`Reset ${key} to default?`)) saveData(key, DEFAULTS[key]);
}

// --- CSV UTILS ---
function downloadCSV(key) {
    const data = db[key];
    if (!data.length) return;
    const headers = Object.keys(data[0]);
    const csv = [headers.join(',')].concat(data.map(row => 
        headers.map(h => {
            let val = String(row[h] || '').replace(/"/g, '""');
            return val.includes(',') ? `"${val}"` : val;
        }).join(',')
    )).join('\n');
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], {type: 'text/csv'}));
    a.download = `ratio_${key}.csv`;
    a.click();
}

function uploadCSV(input, key) {
    const file = input.files[0];
    if(!file) return;
    const r = new FileReader();
    r.onload = e => {
        try {
            const res = parseCSV(e.target.result);
            if(res.length) saveData(key, res);
            else alert("Invalid CSV");
        } catch(err) { alert("Parse Error"); }
        input.value = '';
    };
    r.readAsText(file);
}

function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if(lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    
    return lines.slice(1).map(line => {
        const values = [];
        let cur = '', inQuote = false;
        for(let char of line) {
            if(char === '"' && cur.slice(-1) !== '\\') inQuote = !inQuote;
            else if(char === ',' && !inQuote) { values.push(cur); cur = ''; }
            else cur += char;
        }
        values.push(cur);
        
        return headers.reduce((obj, h, i) => {
            let val = values[i] ? values[i].trim().replace(/^"|"$/g, '').replace(/""/g, '"') : '';
            if(!isNaN(val) && val !== '') val = Number(val);
            if(val === 'True') val = true;
            if(val === 'False') val = false;
            obj[h] = val;
            return obj;
        }, {});
    });
}

// --- UI LOGIC ---
function populateUI() {
    const fill = (id, data, key) => {
        const el = document.getElementById(id);
        el.innerHTML = key ? '<option value="none">None</option>' : '';
        data.forEach((item, i) => {
            const opt = document.createElement('option');
            opt.value = i;
            opt.innerText = item[key] || item.Type || item["Vessel Name"];
            el.appendChild(opt);
        });
    };
    fill('cakeType', db.cakes);
    fill('vessel', db.vessels);
    fill('inclusions', db.inclusions, 'Class');
}

function calculateRecipe() {
    const cake = db.cakes[document.getElementById('cakeType').value];
    const vessel = db.vessels[document.getElementById('vessel').value];
    const incIdx = document.getElementById('inclusions').value;
    const inclusion = incIdx !== 'none' ? db.inclusions[incIdx] : null;

    const totalParts = Number(cake.Flour) + Number(cake.Sugar) + Number(cake.Fat) + Number(cake.Egg) + Number(cake.Liquid);
    const factor = vessel["Total Mass (g)"] / totalParts;
    
    const getW = (part) => (cake[part] * factor) || 0;
    const wFlour = getW('Flour');
    
    document.getElementById('resultCard').style.display = 'block';
    document.getElementById('resultCard').scrollIntoView({behavior: 'smooth'});
    document.getElementById('outTitle').innerText = cake.Type;
    document.getElementById('outMeta').innerText = `${vessel["Vessel Name"]} • ${cake.Type.includes("Brownie") ? "160°C" : "175°C"}`;

    const warn = document.getElementById('safetyWarning');
    warn.style.display = vessel["Safety Warning"] ? 'block' : 'none';
    warn.innerText = vessel["Safety Warning"];

    let html = "";
    const row = (n, w, d) => `
        <div class="ingredient-row">
            <div><span class="ingredient-name">${n}</span><span class="ingredient-detail">${d}</span></div>
            <div class="ingredient-amt">${w.toFixed(0)}g</div>
        </div>`;

    // Flour logic
    let fDesc = "AP Flour";
    if(cake.Type.toLowerCase().includes("brownie")) fDesc = `Mix: ${(wFlour*0.8).toFixed(0)}g Flour + ${(wFlour*0.2).toFixed(0)}g Cocoa`;
    
    html += row("Flour", wFlour, fDesc);
    html += row("Sugar", getW('Sugar'), cake.Sugar_Prep);
    html += row("Fat", getW('Fat'), cake.Fat_Prep);
    html += row("Egg", getW('Egg'), `~${(getW('Egg')/50).toFixed(1)} eggs`);
    if(cake.Liquid > 0) html += row("Liquid", getW('Liquid'), cake.Liquid_Prep);
    
    html += row("Salt", wFlour*0.017, "Sea Salt");
    html += row("Vanilla", wFlour*0.075, "Extract");
    if(String(cake.BP_Required) === 'true') html += row("Baking Powder", wFlour*0.03, "Chemical Leavener");
    
    if(inclusion) html += row("Add-in", wFlour * inclusion["Max %"], inclusion.Class);

    document.getElementById('ingredientsList').innerHTML = html;
    
    let prep = `<strong>Fat:</strong> ${cake.Fat_Prep}<br><strong>Sugar:</strong> ${cake.Sugar_Prep}`;
    if(cake.Liquid > 0) prep += `<br><strong>Liquid:</strong> ${cake.Liquid_Prep}`;
    document.getElementById('outPrep').innerHTML = prep;
    document.getElementById('outMethod').innerText = cake.Method;
}

function generateSettingsUI() {
    const container = document.getElementById('settingsContainer');
    ['cakes', 'vessels', 'inclusions'].forEach(key => {
        const div = document.createElement('div');
        div.className = 'setting-group';
        div.innerHTML = `
            <h3>${key.toUpperCase()}</h3>
            <div class="btn-row">
                <button onclick="downloadCSV('${key}')" class="btn-sec">↓ CSV</button>
                <label class="btn-sec">↑ CSV <input type="file" onchange="uploadCSV(this, '${key}')" accept=".csv"></label>
                <button onclick="resetData('${key}')" class="btn-danger">Reset</button>
            </div>`;
        container.appendChild(div);
    });
}

function setupModal() {
    const m = document.getElementById("settingsModal");
    document.getElementById("settingsBtn").onclick = () => m.style.display = "block";
    document.querySelector(".close-modal").onclick = () => m.style.display = "none";
    window.onclick = e => { if(e.target == m) m.style.display = "none"; };
}