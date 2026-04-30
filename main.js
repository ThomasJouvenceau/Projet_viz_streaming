const margin = { top: 40, right: 30, bottom: 60, left: 100 };
const width = 450 - margin.left - margin.right;
const height = 350 - margin.top - margin.bottom;

d3.csv("data/streaming_catalog.csv").then(function(data) {
    
    data.forEach(d => {
        d.release_year = +d.release_year;
        d.imdb_rating = +d.imdb_rating;
    });

    const platforms = [...new Set(data.map(d => d.platform))].filter(Boolean).sort();
    const countries = [...new Set(data.map(d => d.country))].filter(Boolean).sort();
    const genres = [...new Set(data.map(d => d.primary_genre))].filter(Boolean).sort();
    const types = [...new Set(data.map(d => d.type))].filter(Boolean).sort();

    const populateSelect = (id, options) => {
        const select = d3.select(id);
        options.forEach(opt => select.append("option").attr("value", opt).text(opt));
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
        
        const minVolume = +d3.select("#minVolume").property("value");
        d3.select("#volumeLabel").text(minVolume);

        let filteredData = data.filter(d => d.release_year >= yearStart && d.release_year <= yearEnd);

        if (selectedPlatform !== "All") filteredData = filteredData.filter(d => d.platform === selectedPlatform);
        if (selectedCountry !== "All") filteredData = filteredData.filter(d => d.country === selectedCountry);
        if (selectedGenre !== "All") filteredData = filteredData.filter(d => d.primary_genre === selectedGenre);
        if (selectedType !== "All") filteredData = filteredData.filter(d => d.type === selectedType);

        d3.select("#stacked-bar-chart").html(""); 
        d3.select("#donut-chart").html(""); 
        d3.select("#line-chart").html("");
        d3.select("#rating-bar-chart").html("");

        // 1. Line Chart
        const yearCounts = d3.rollup(filteredData, v => v.length, d => d.release_year);
        const lineData = Array.from(yearCounts, ([release_year, total_titles]) => ({release_year, total_titles}))
                             .filter(d => d.release_year >= yearStart && d.release_year <= yearEnd)
                             .sort((a, b) => a.release_year - b.release_year);
        if (lineData.length > 0) {
            d3.select("#line-chart").style("display", "block");
            drawLineChart(lineData);
        } else {
            d3.select("#line-chart").style("display", "none");
        }

        // 2. Stacked Bar Chart
        const platformsData = Array.from(d3.group(filteredData, d => d.platform), ([platform, values]) => {
            const movies = values.filter(v => v.type === "Movie").length;
            const shows = values.filter(v => v.type === "TV Show").length;
            return { platform, Movie: movies, "TV Show": shows, total: movies + shows };
        }).filter(d => d.platform && d.platform !== "NaN" && d.total > 0).sort((a,b) => b.total - a.total);
        
        if (platformsData.length > 1) { 
            d3.select("#stacked-bar-chart").style("display", "block");
            drawStackedBarChart(platformsData);
        } else {
            d3.select("#stacked-bar-chart").style("display", "none");
        }

        // 3. Horizontal Bar Chart (Top Genres par Note Moyenne)
        const genreStats = Array.from(d3.group(filteredData, d => d.primary_genre), ([genre, values]) => {
            const count = values.length;
            const validRatings = values.filter(v => v.imdb_rating > 0);
            const avgImdb = validRatings.length > 0 ? d3.mean(validRatings, d => d.imdb_rating) : 0;
            return { genre, count, avgImdb };
        }).filter(d => d.genre && d.genre !== "NaN" && d.avgImdb > 0 && d.count >= minVolume)
          .sort((a, b) => b.avgImdb - a.avgImdb)
          .slice(0, 10);
        
        if (genreStats.length > 1) { 
            d3.select("#rating-bar-chart").style("display", "block");
            drawRatingBarChart(genreStats);
        } else {
            d3.select("#rating-bar-chart").style("display", "none");
        }

        // 4. Donut Chart
        let donutData = Array.from(d3.group(filteredData, d => d.primary_genre), ([genre, values]) => {
            return { genre, count: values.length };
        }).filter(d => d.genre && d.genre !== "NaN" && d.count > 0).sort((a, b) => b.count - a.count);

        if (donutData.length > 1) {
            d3.select("#donut-chart").style("display", "block");
            const topGenres = donutData.slice(0, 5);
            if (donutData.length > 5) {
                const othersCount = d3.sum(donutData.slice(5), d => d.count);
                topGenres.push({ genre: "Autres", count: othersCount });
            }
            drawDonutChart(topGenres);
        } else {
            d3.select("#donut-chart").style("display", "none");
        }
    }

    d3.selectAll("select, input").on("change", updateDashboard);
    d3.selectAll("input[type=range], input[type=number]").on("input", updateDashboard);

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
    const customMargin = { top: 40, right: 30, bottom: 80, left: 60 };
    const svg = d3.select("#stacked-bar-chart").append("svg")
        .attr("width", width + customMargin.left + customMargin.right)
        .attr("height", height + customMargin.top + customMargin.bottom)
        .append("g").attr("transform", `translate(${customMargin.left},${customMargin.top})`);

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
}

function drawRatingBarChart(data) {
    const svg = d3.select("#rating-bar-chart").append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, 10]).range([0, width]);
    const y = d3.scaleBand().domain(data.map(d => d.genre)).range([0, height]).padding(0.2);

    svg.append("g").attr("transform", `translate(0,${height})`).call(d3.axisBottom(x));
    svg.append("g").call(d3.axisLeft(y));

    svg.selectAll("rect").data(data).enter().append("rect")
       .attr("x", 0)
       .attr("y", d => y(d.genre))
       .attr("width", d => Math.max(0, x(d.avgImdb)))
       .attr("height", y.bandwidth())
       .attr("fill", "#76b7b2");

    svg.selectAll(".label").data(data).enter().append("text")
       .attr("x", d => Math.max(0, x(d.avgImdb)) - 5)
       .attr("y", d => y(d.genre) + y.bandwidth() / 2 + 4)
       .attr("text-anchor", "end")
       .style("fill", "white")
       .style("font-size", "11px")
       .text(d => d.avgImdb.toFixed(1));

    svg.append("text").attr("x", width/2).attr("y", -10).attr("text-anchor", "middle").text("Top 10 Genres par Note IMDb");
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

    svg.append("text").attr("x", 0).attr("y", - (fullHeight / 2) + 15).attr("text-anchor", "middle").text("Top 5 Genres par Volume");
}