const margin = { top: 40, right: 30, bottom: 80, left: 60 };
const width = 450 - margin.left - margin.right;
const height = 350 - margin.top - margin.bottom;

d3.csv("data/streaming_catalog.csv").then(function(data) {
    
    // Nettoyage et conversion des données
    data.forEach(d => {
        d.release_year = +d.release_year;
        d.imdb_rating = +d.imdb_rating;
    });

    // Listes uniques pour les filtres
    const platforms = [...new Set(data.map(d => d.platform))].filter(Boolean).sort();
    const countries = [...new Set(data.map(d => d.country))].filter(Boolean).sort();
    const genres = [...new Set(data.map(d => d.primary_genre))].filter(Boolean).sort();
    const types = [...new Set(data.map(d => d.type))].filter(Boolean).sort();

    // Remplissage dynamique des menus déroulants
    const populateSelect = (id, options) => {
        const select = d3.select(id);
        options.forEach(opt => {
            select.append("option").attr("value", opt).text(opt);
        });
    };

    populateSelect("#platformSelect", platforms);
    populateSelect("#countrySelect", countries);
    populateSelect("#genreSelect", genres);
    populateSelect("#typeSelect", types);

    function updateDashboard() {
        const selectedPlatform = d3.select("#platformSelect").property("value");
        const selectedCountry = d3.select("#countrySelect").property("value");
        const selectedGenre = d3.select("#genreSelect").property("value");
        const selectedType = d3.select("#typeSelect").property("value");
        const yearStart = +d3.select("#yearStart").property("value");
        const yearEnd = +d3.select("#yearEnd").property("value");
        
        // Valeur du slider pour le nuage de points
        const minVolume = +d3.select("#minVolume").property("value");
        d3.select("#volumeLabel").text(minVolume);

        // Application des filtres globaux
        let filteredData = data.filter(d => d.release_year >= yearStart && d.release_year <= yearEnd);

        if (selectedPlatform !== "All") filteredData = filteredData.filter(d => d.platform === selectedPlatform);
        if (selectedCountry !== "All") filteredData = filteredData.filter(d => d.country === selectedCountry);
        if (selectedGenre !== "All") filteredData = filteredData.filter(d => d.primary_genre === selectedGenre);
        if (selectedType !== "All") filteredData = filteredData.filter(d => d.type === selectedType);

        // Vider les graphiques
        d3.select("#stacked-bar-chart").html(""); 
        d3.select("#donut-chart").html(""); 
        d3.select("#line-chart").html("");
        d3.select("#scatter-plot").html("");

        // 1. Line Chart
        const yearCounts = d3.rollup(filteredData, v => v.length, d => d.release_year);
        const lineData = Array.from(yearCounts, ([release_year, total_titles]) => ({release_year, total_titles}))
                             .filter(d => d.release_year >= yearStart && d.release_year <= yearEnd)
                             .sort((a, b) => a.release_year - b.release_year);
        if (lineData.length > 0) drawLineChart(lineData);

        // 2. Stacked Bar Chart (Apparaît uniquement si Platform = "All")
        if (selectedPlatform === "All") {
            d3.select("#stacked-bar-chart").style("display", "block");
            const platformsData = Array.from(d3.group(filteredData, d => d.platform), ([platform, values]) => {
                const movies = values.filter(v => v.type === "Movie").length;
                const shows = values.filter(v => v.type === "TV Show").length;
                return { platform, Movie: movies, "TV Show": shows, total: movies + shows };
            }).filter(d => d.platform && d.platform !== "NaN").sort((a,b) => b.total - a.total);
            
            if (platformsData.length > 0) drawStackedBarChart(platformsData);
        } else {
            d3.select("#stacked-bar-chart").style("display", "none");
        }

        // 3. Scatter Plot (Filtre par minVolume appliqué ici)
        const genreStats = Array.from(d3.group(filteredData, d => d.primary_genre), ([genre, values]) => {
            const count = values.length;
            const validRatings = values.filter(v => v.imdb_rating > 0);
            const avgImdb = validRatings.length > 0 ? d3.mean(validRatings, d => d.imdb_rating) : 0;
            return { genre, count, avgImdb };
        }).filter(d => d.genre && d.genre !== "NaN" && d.avgImdb > 0 && d.count >= minVolume);
        
        if (genreStats.length > 0) drawScatterPlot(genreStats);

        // 4. Donut Chart
        let genreData = Array.from(d3.group(filteredData, d => d.primary_genre), ([genre, values]) => {
            return { genre, count: values.length };
        }).filter(d => d.genre && d.genre !== "NaN").sort((a, b) => b.count - a.count);

        const topGenres = genreData.slice(0, 5);
        if (genreData.length > 5) {
            const othersCount = d3.sum(genreData.slice(5), d => d.count);
            topGenres.push({ genre: "Autres", count: othersCount });
        }
        if (topGenres.length > 0) drawDonutChart(topGenres);
    }

    // Écouteurs d'événements
    d3.selectAll("select, input").on("change", updateDashboard);
    d3.selectAll("input").on("input", updateDashboard);

    updateDashboard();

}).catch(err => console.error("Erreur : ", err));


function drawLineChart(data) {
    const svg = d3.select("#line-chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.release_year)).range([0, width]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.total_titles) || 10]).range([height, 0]);

    svg.append("path").datum(data).attr("fill", "none").attr("stroke", "#e15759")
       .attr("stroke-width", 2).attr("d", d3.line().x(d => x(d.release_year)).y(d => y(d.total_titles)));

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
    svg.append("g").call(d3.axisLeft(y));
    svg.append("text").attr("x", width/2).attr("y", -10).attr("text-anchor", "middle").text("Évolution annuelle");
}

function drawStackedBarChart(data) {
    const svg = d3.select("#stacked-bar-chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const keys = ["Movie", "TV Show"];
    const stack = d3.stack().keys(keys)(data);
    const color = d3.scaleOrdinal().domain(keys).range(["#4e79a7", "#f28e2c"]);

    const x = d3.scaleBand().domain(data.map(d => d.platform)).range([0, width]).padding(0.2);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.total) || 10]).range([height, 0]);

    svg.append("g").selectAll("g").data(stack).enter().append("g").attr("fill", d => color(d.key))
       .selectAll("rect").data(d => d).enter().append("rect")
       .attr("x", d => x(d.data.platform)).attr("y", d => y(d[1]))
       .attr("height", d => y(d[0]) - y(d[1])).attr("width", x.bandwidth());

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x))
       .selectAll("text").attr("transform", "rotate(-45)").style("text-anchor", "end");
    svg.append("g").call(d3.axisLeft(y));
    svg.append("text").attr("x", width/2).attr("y", -10).attr("text-anchor", "middle").text("Films vs Séries par Plateforme");
    
    // Légende
    const legend = svg.append("g").attr("transform", `translate(${width - 80}, 0)`);
    keys.forEach((key, i) => {
        const legendRow = legend.append("g").attr("transform", `translate(0, ${i * 20})`);
        legendRow.append("rect").attr("width", 10).attr("height", 10).attr("fill", color(key));
        legendRow.append("text").attr("x", 20).attr("y", 10).text(key === "Movie" ? "Films" : "Séries");
    });
}

function drawScatterPlot(data) {
    const svg = d3.select("#scatter-plot").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, d3.max(data, d => d.count) * 1.1]).range([0, width]);
    
    // Zoom dynamique sur l'axe Y (Notes)
    const minRating = d3.min(data, d => d.avgImdb) - 0.2;
    const maxRating = d3.max(data, d => d.avgImdb) + 0.2;
    const y = d3.scaleLinear().domain([minRating || 0, maxRating || 10]).range([height, 0]);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(y));

    svg.selectAll("circle").data(data).enter().append("circle")
       .attr("cx", d => x(d.count)).attr("cy", d => y(d.avgImdb))
       .attr("r", 6).attr("fill", "#76b7b2").attr("opacity", 0.7);

    // Ajout des étiquettes (labels)
    svg.selectAll(".label").data(data).enter().append("text")
       .attr("class", "label").attr("x", d => x(d.count) + 8).attr("y", d => y(d.avgImdb) + 4)
       .text(d => d.genre).style("font-size", "10px");

    svg.append("text").attr("x", width/2).attr("y", height + 35).style("text-anchor", "middle").style("font-size", "12px").text("Volume de titres");
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -height/2).attr("y", -35).style("text-anchor", "middle").style("font-size", "12px").text("Note IMDb Moyenne");
    svg.append("text").attr("x", width/2).attr("y", -10).attr("text-anchor", "middle").text("Qualité vs Quantité");
}

function drawDonutChart(data) {
    const fullWidth = width + margin.left + margin.right;
    const fullHeight = height + margin.top + margin.bottom;
    const radius = Math.min(fullWidth, fullHeight) / 2 - 40; 

    const svg = d3.select("#donut-chart").append("svg")
        .attr("width", fullWidth).attr("height", fullHeight)
        .append("g").attr("transform", `translate(${fullWidth / 2}, ${fullHeight / 2 + 10})`);

    const pie = d3.pie().value(d => d.count).sort(null);
    const arc = d3.arc().innerRadius(radius * 0.5).outerRadius(radius * 0.8);
    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const arcs = svg.selectAll("arc").data(pie(data)).enter().append("g");
    arcs.append("path").attr("d", arc).attr("fill", d => color(d.data.genre)).attr("stroke", "white").style("stroke-width", "2px");
    arcs.append("text").attr("transform", d => `translate(${arc.centroid(d)[0] * 1.5}, ${arc.centroid(d)[1] * 1.5})`)
        .attr("text-anchor", "middle").style("font-size", "11px").style("font-weight", "bold").text(d => `${d.data.genre} (${d.data.count})`);

    svg.append("text").attr("x", 0).attr("y", - (fullHeight / 2) + 15).attr("text-anchor", "middle").text("Top 5 Genres");
}