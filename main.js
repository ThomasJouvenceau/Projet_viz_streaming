const margin = { top: 40, right: 30, bottom: 60, left: 60 };
const width = 500 - margin.left - margin.right;
const height = 350 - margin.top - margin.bottom;

d3.csv("data/streaming_catalog.csv").then(function(data) {
    
    data.forEach(d => {
        d.release_year = +d.release_year;
    });

    const platforms = [...new Set(data.map(d => d.platform))].filter(Boolean).sort();
    const countries = [...new Set(data.map(d => d.country))].filter(Boolean).sort();
    const genres = [...new Set(data.map(d => d.primary_genre))].filter(Boolean).sort();

    const populateSelect = (id, options) => {
        const select = d3.select(id);
        options.forEach(opt => {
            select.append("option").attr("value", opt).text(opt);
        });
    };

    populateSelect("#platformSelect", platforms);
    populateSelect("#countrySelect", countries);
    populateSelect("#genreSelect", genres);

    function updateDashboard() {
        const selectedPlatform = d3.select("#platformSelect").property("value");
        const selectedCountry = d3.select("#countrySelect").property("value");
        const selectedGenre = d3.select("#genreSelect").property("value");

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

        const genreCounts = d3.rollup(filteredData, v => v.length, d => d.primary_genre);
        let genreData = Array.from(genreCounts, ([genre, count]) => ({genre, count}))
                             .filter(d => d.genre && d.genre !== "NaN")
                             .sort((a, b) => b.count - a.count);

        const topGenres = genreData.slice(0, 5);
        if (genreData.length > 5) {
            const othersCount = d3.sum(genreData.slice(5), d => d.count);
            topGenres.push({ genre: "Autres", count: othersCount });
        }

        const yearCounts = d3.rollup(filteredData, v => v.length, d => d.release_year);
        const lineData = Array.from(yearCounts, ([release_year, total_titles]) => ({release_year, total_titles}))
                             .filter(d => d.release_year > 1900)
                             .sort((a, b) => a.release_year - b.release_year);

        d3.select("#donut-chart").html(""); 
        d3.select("#line-chart").html("");

        if (topGenres.length > 0) drawDonutChart(topGenres);
        if (lineData.length > 0) drawLineChart(lineData);
    }

    d3.selectAll("select").on("change", updateDashboard);

    updateDashboard();

}).catch(err => {
    console.error("Erreur lors du chargement des données : ", err);
});

function drawDonutChart(data) {
    const fullWidth = width + margin.left + margin.right;
    const fullHeight = height + margin.top + margin.bottom;
    const radius = Math.min(fullWidth, fullHeight) / 2 - 20;

    const svg = d3.select("#donut-chart")
        .append("svg")
        .attr("width", fullWidth)
        .attr("height", fullHeight)
        .append("g")
        .attr("transform", `translate(${fullWidth / 2}, ${fullHeight / 2 + 10})`);

    const color = d3.scaleOrdinal(d3.schemeTableau10);

    const pie = d3.pie()
        .value(d => d.count)
        .sort(null);

    const arc = d3.arc()
        .innerRadius(radius * 0.5)
        .outerRadius(radius * 0.8);

    const arcs = svg.selectAll("arc")
        .data(pie(data))
        .enter()
        .append("g");

    arcs.append("path")
        .attr("d", arc)
        .attr("fill", d => color(d.data.genre))
        .attr("stroke", "white")
        .style("stroke-width", "2px")
        .style("opacity", 0.9);

    arcs.append("text")
        .attr("transform", function(d) {
            const pos = arc.centroid(d);
            return `translate(${pos[0] * 1.4}, ${pos[1] * 1.4})`;
        })
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("font-weight", "bold")
        .style("fill", "#333")
        .text(d => d.data.genre);

    svg.append("text")
        .attr("x", 0)
        .attr("y", - (fullHeight / 2) + 15)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("fill", "#666")
        .text("Répartition des genres (Top 5)");
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
        .style("font-size", "14px")
        .style("fill", "#666")
        .text("Évolution annuelle filtrée");
}