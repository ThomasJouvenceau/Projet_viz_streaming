// 1. CONFIGURATION GÉNÉRALE
const margin = { top: 40, right: 30, bottom: 60, left: 60 };
const width = 500 - margin.left - margin.right;
const height = 350 - margin.top - margin.bottom;

// 2. CHARGEMENT ASYNCHRONE DES FICHIERS CSV
const files = [
    "data/platform_summary.csv",
    "data/yearly_release_trends.csv"
];

Promise.all(files.map(url => d3.csv(url))).then(function(values) {
    const platformData = values[0];
    const trendsData = values[1];

    // Nettoyage des données : conversion texte -> nombre
    // On utilise ici le vrai nom de ta colonne : "total_titles"
    platformData.forEach(d => {
        d.total_titles = +d.total_titles; 
    });
    
    trendsData.forEach(d => {
        d.release_year = +d.release_year;
        d.total_titles = +d.total_titles;
    });

    console.log("Données chargées et nettoyées !");

    // 3. INITIALISATION DES GRAPHIQUES
    drawBarChart(platformData);
    drawLineChart(trendsData);

}).catch(err => {
    console.error("Erreur lors du chargement des données : ", err);
});


// --- FONCTION : GRAPHIQUE À BARRES (Plateformes) ---
function drawBarChart(data) {
    const svg = d3.select("#bar-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Échelles (Scales)
    const x = d3.scaleBand()
        .domain(data.map(d => d.platform))
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total_titles)]) // Changé ici
        .range([height, 0]);

    // Dessin des barres
    svg.selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x(d.platform))
        .attr("y", d => y(d.total_titles)) // Changé ici
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.total_titles)) // Changé ici
        .attr("fill", "#4e79a7");

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    svg.append("g").call(d3.axisLeft(y));

    // Titre
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text("Volume de contenu par plateforme");
}


// --- FONCTION : GRAPHIQUE LINÉAIRE (Tendances Annuelles) ---
function drawLineChart(data) {
    const svg = d3.select("#line-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Trier les données par année
    data.sort((a, b) => a.release_year - b.release_year);

    // Échelles
    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.release_year))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total_titles)]) // Changé ici
        .range([height, 0]);

    // Définir la ligne
    const line = d3.line()
        .x(d => x(d.release_year))
        .y(d => y(d.total_titles)); // Changé ici

    // Dessin de la ligne
    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#e15759")
        .attr("stroke-width", 2)
        .attr("d", line);

    // Axes
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d"))); // tickFormat corrigé ici

    svg.append("g").call(d3.axisLeft(y));

    // Titre
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text("Évolution annuelle des sorties");
}