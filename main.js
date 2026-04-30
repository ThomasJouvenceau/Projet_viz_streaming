const margin = { top: 40, right: 30, bottom: 60, left: 60 };
const width = 500 - margin.left - margin.right;
const height = 350 - margin.top - margin.bottom;

// Utilisation du fichier global pour permettre le filtrage croisé
d3.csv("data/streaming_catalog.csv").then(function(data) {
    
    // Nettoyage
    data.forEach(d => {
        d.release_year = +d.release_year;
    });

    // Extraction des valeurs uniques pour les filtres
    const platforms = [...new Set(data.map(d => d.platform))].filter(Boolean).sort();
    const countries = [...new Set(data.map(d => d.country))].filter(Boolean).sort();
    const genres = [...new Set(data.map(d => d.primary_genre))].filter(Boolean).sort();

    // Remplissage des menus déroulants
    const populateSelect = (id, options) => {
        const select = d3.select(id);
        options.forEach(opt => {
            select.append("option").attr("value", opt).text(opt);
        });
    };

    populateSelect("#platformSelect", platforms);
    populateSelect("#countrySelect", countries);
    populateSelect("#genreSelect", genres);

    // Fonction de mise à jour globale
    function updateDashboard() {
        const selectedPlatform = d3.select("#platformSelect").property("value");
        const selectedCountry = d3.select("#countrySelect").property("value");
        const selectedGenre = d3.select("#genreSelect").property("value");

        // Filtrage des données brutes
        let filteredData = data;
        if (selectedPlatform !== "All") {
            filteredData = filteredData.filter(d => d.platform === selectedPlatform);
        }
        if (selectedCountry !== "All") {
            filteredData = filteredData.filter(d => d.country === selectedCountry);
        }
        if (selectedGenre !== "All") {
            filteredData = filteredData.filter(d => d.primary_genre === selectedGenre);
        }

        // Agrégation pour le Bar Chart (Comptage par plateforme)
        const platformCounts = d3.rollup(filteredData, v => v.length, d => d.platform);
        const barData = Array.from(platformCounts, ([platform, total_titles]) => ({platform, total_titles}));

        // Agrégation pour le Line Chart (Comptage par année)
        const yearCounts = d3.rollup(filteredData, v => v.length, d => d.release_year);
        const lineData = Array.from(yearCounts, ([release_year, total_titles]) => ({release_year, total_titles}))
                             .filter(d => d.release_year > 0) // Exclure les années vides/invalides
                             .sort((a, b) => a.release_year - b.release_year);

        // Effacer les anciens graphiques
        d3.select("#bar-chart").html("");
        d3.select("#line-chart").html("");

        // Redessiner
        if (barData.length > 0) drawBarChart(barData);
        if (lineData.length > 0) drawLineChart(lineData);
    }

    // Écouteurs d'événements sur les 3 filtres
    d3.selectAll("select").on("change", updateDashboard);

    // Initialisation au premier chargement
    updateDashboard();

}).catch(err => {
    console.error("Erreur lors du chargement des données : ", err);
});

function drawBarChart(data) {
    const svg = d3.select("#bar-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand()
        .domain(data.map(d => d.platform))
        .range([0, width])
        .padding(0.2);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total_titles) || 10]) 
        .range([height, 0]);

    svg.selectAll("rect")
        .data(data)
        .enter()
        .append("rect")
        .attr("x", d => x(d.platform))
        .attr("y", d => y(d.total_titles))
        .attr("width", x.bandwidth())
        .attr("height", d => height - y(d.total_titles))
        .attr("fill", "#4e79a7");

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x))
        .selectAll("text")
        .attr("transform", "rotate(-45)")
        .style("text-anchor", "end");

    svg.append("g").call(d3.axisLeft(y));

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text("Volume de contenu filtré par plateforme");
}

function drawLineChart(data) {
    const svg = d3.select("#line-chart")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear()
        .domain(d3.extent(data, d => d.release_year))
        .range([0, width]);

    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.total_titles) || 10])
        .range([height, 0]);

    const line = d3.line()
        .x(d => x(d.release_year))
        .y(d => y(d.total_titles));

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "#e15759")
        .attr("stroke-width", 2)
        .attr("d", line);

    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    svg.append("g").call(d3.axisLeft(y));

    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .text("Évolution annuelle filtrée");
}