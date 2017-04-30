const n_neur = 30;
const n_item = 50;


var users_coord;
var movies_coord;
var movies_titles_genres;
var user_titles;
var movie_popularity = null;
var movie_bias = null;
var movie_colors = null;

var prediction_rates = null; 

var currentItem = 29;
var sliderValue = 29;

var currentUser = null;
var pathsToggled = true;

var currentMovie = null;

var svg_padding = 30;

// loader settings
var opts = {
    lines: 11, // The number of lines to draw
    length: 15, // The length of each line
    width: 5, // The line thickness
    radius: 20, // The radius of the inner circle
    color: '#4682b4', // #rgb or #rrggbb or array of colors
    speed: 1.9, // Rounds per second
    trail: 40, // Afterglow percentage
    className: 'spinner', // The CSS class to assign to the spinner
};
var target = document.getElementById('center');




// TOOLTIP
function tipObject(){
    this.text = null;
    this.imageSrc =null;
    this.element = d3.select('body')
        .append('div')
        .attr('class', 'tip')
        .html('I am a tooltip...')
        .style("opacity", 0);
    this.setText = function(text) {
        this.text = text;
    }
    this.setImageSrc = function(imageSrc) {
        this.imageSrc = imageSrc;
    }
    this.renderHtml = function(image = false){
        if(image){
            this.element.html(this.text + "<img width='150px' src='" +this.imageSrc + "' >");
        }
        else{
            this.element.html(this.text);
        }
    }
    this.show = function(){
        this.element.style("opacity", .9);
    }
    this.hide = function(){
        this.element.style("opacity", 0);
    }
    this.setPosition = function(x,y){
         this.element.style('top', (y - 50) + 'px')
                    .style('left', (x - 30) + 'px');
    }

}

var tip = new tipObject();

$(".info").hover(function(){
    $("#"+$(this).attr("linked_id")).toggle();
});


function update_current_selection_text(){
    $("#current_selections").text("Currently selected: User: "+currentUser+" --- Sequence: "+currentItem+" --- Movie: "+currentMovie+"");
}

/********************************************************************************
  _   _   ____    _____   ____      ____       _      _   _   _____   _     
 | | | | / ___|  | ____| |  _ \    |  _ \     / \    | \ | | | ____| | |    
 | | | | \___ \  |  _|   | |_) |   | |_) |   / _ \   |  \| | |  _|   | |    
 | |_| |  ___) | | |___  |  _ <    |  __/   / ___ \  | |\  | | |___  | |___ 
  \___/  |____/  |_____| |_| \_\   |_|     /_/   \_\ |_| \_| |_____| |_____|
                                                                            
*********************************************************************************/

var spinner_user = new Spinner(opts).spin();


var userZone = {x: [0, 1000], y: [0, 600]};

var svg_users = d3.select("#user_div").append("svg")
    .attr("class", "svg users_svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 " + userZone.x[1] + " " + userZone.y[1])
    .classed("svg-content-responsive", true);

var users_circles = svg_users.append("g")
        .attr("class", "users_circles");



spinner_user.spin(target);
$.ajax({
    type: "GET",
    url: "http://127.0.0.1:8000/",
    dataType: 'json',
    data: {
        plot: 'users',
        sequenceNbr: 29,
    },
    success: function (newData) {
        users_coord = newData;
        $.ajax({
            type: "GET",
            url: "http://127.0.0.1:8000/",
            dataType: 'json',
            data: {
                user_titles: 1,
            },
            success: function (newData) {
                spinner_user.stop();
                user_titles = newData;
                updateUsers();
            }
        });

    }
});

function updateUsers(){
    var users_dataset = [];
    users_coord.forEach(function (val, i) {
        users_dataset.push({
            'id': user_titles[i],
            'x': users_coord[i][0],
            'y': users_coord[i][1],
            'title': 'user ' + user_titles[i]
        })
    });


    var u_x = d3.scaleLinear()
        .domain([d3.min(users_coord, function (d) {
            return d[0];
        }), d3.max(users_coord, function (d) {
            return d[0];
        })])
        .range([userZone.x[0] + svg_padding, userZone.x[1] - svg_padding]);

    var u_y = d3.scaleLinear()
        .domain([d3.min(users_coord, function (d) {
            return d[1];
        }), d3.max(users_coord, function (d) {
            return d[1];
        })])
        .range([userZone.y[1] - svg_padding, userZone.y[0] + svg_padding]);


 

    var circles = users_circles.selectAll("circle")
        .data(users_dataset)

    circles.enter()
        .append("circle")
        .merge(circles)
        .attr("cx", function (d) {
            return u_x(d.x);
        })
        .attr("cy", function (d) {
            return u_y(d.y);
        })
        .attr("r", 5)
        .attr("stroke", "#1573c1")
        .attr("stroke-width", 0.1)
        .attr("id", function (d) {
            return d.id;
        })
        .on('mouseover', function (d) {
            tip.setText(d.title);
            tip.renderHtml(image = false);
            tip.show();
        })
        .on('mousemove', function (d) {
            tip.setPosition(d3.event.pageX,d3.event.pageY)
        })
        .on('mouseout', function (d) {
            tip.hide();
        })
        .on('mousedown', function (d) {
            currentUser = d.id;
            currentMovie = null;
            update_current_selection_text();
            
            users_circles.selectAll("circle").style('fill', 'steelblue');
            d3.select(this).style('fill', 'red');

            remove_saliency();
            user_clicked(d.id);
        });

    circles.exit().remove();

    var zoom_user = d3.zoom()
        .scaleExtent([1, 40])
        //.translateExtent([[-100, -100], [width + 90, height + 100]])
        .on("zoom", zoomed_user);

    svg_users.call(zoom_user);
}


function zoomed_user() {
    users_circles.attr("transform", d3.event.transform);
}

function predictionRate() {
    if (prediction_rates != null){
        colorPredictionRates(prediction_rates);
    }
    else{
        spinner_user.spin(target);
        $.ajax({
            type: "GET",
            url: "http://127.0.0.1:8000/",
            dataType: 'json',
            data: {
                user_prediction_rate: 1,
            },
            success: function (newData) {
                prediction_rates = newData;
                colorPredictionRates(newData);
            },
            complete: function (data) {
                spinner_user.stop();
            }
        });
    }
}

function colorPredictionRates(prediction_rates){
    var scale = chroma.scale('RdYlBu').domain([d3.max(prediction_rates), d3.min(prediction_rates)]);
    var svg_users = d3.select(".users_svg");

    svg_users.selectAll('circle')
        .each(function (d, index) {
            var rate = prediction_rates[index];
            d3.select(this).transition()
                .duration(400)
                .style("fill",
                    scale(rate).hex()
                );
        });
}



function user_clicked(user_id) {
    spinner_user.spin(target);
    $.ajax({
        type: "GET",
        url: "http://127.0.0.1:8000/",
        dataType: 'json',
        data: {
            user_clicked: user_id,
        },
        success: function (sequence_prediction) {
            if (currentItem > sequence_prediction.H.length - 1) {
                currentItem = sequence_prediction.H.length - 1;
            }
            highlight_init_sequence(sequence_prediction.init_sequence.slice(0, currentItem + 1), sequence_prediction.goals);
            var lastItem = sequence_prediction.predictions.slice(currentItem)[0]
            highlight_prediction(lastItem.prediction, sequence_prediction.predictions);

            displayNeuronHeatmap(sequence_prediction.H,sequence_prediction )

        // TO HAVE THE HEATMAP SORTED:
           /* $.ajax({
                type: "GET",
                url: "http://127.0.0.1:8000/",
                dataType: 'json',
                data: {
                    user_sorted_heatmap: user_id,
                },
                success: function (sorted_heatmap) {
                    displayNeuronHeatmap(sorted_heatmap, sequence_prediction);
                },
                complete: function (data) {
                    spinner.stop();
                }
            });*/

        },

    });

    $.ajax({
        type: "GET",
        url: "http://127.0.0.1:8000/",
        dataType: 'json',
        data: {
            user_gates: user_id,
        },
        success: function (gate_data) {

            displayUpdateGateHeatmap(gate_data.update_gate);
            displayResetGateHeatmap(gate_data.reset_gate);
            displayCandidateGateHeatmap(gate_data.hidden_update);
        },
        complete: function (data) {
            spinner_user.stop();
        }
    });
}

function highlighCurrentUser() {
    if (currentUser != null){
        svg_users.selectAll('circle')
                .each(function (d) {
                    elem = d3.select(this);
                    if (elem.datum().id == currentUser) {
                        elem.style("fill", "red")
                            .raise();
                    };
                });
    }
}

function updateSlider(slideAmount) {
    var sliderDiv = document.getElementById("sliderAmount");
    sliderDiv.innerHTML = slideAmount;
    spinner_user.spin(target);
    $.ajax({
        type: "GET",
        url: "http://127.0.0.1:8000/",
        dataType: 'json',
        data: {
            plot: 'users',
            sequenceNbr: slideAmount,
        },
        success: function (newData) {
            users_coord = newData;
            spinner_user.stop();
            updateUsers()
            
        }
    });
}

 $('#searchForm').submit(function(e){
    e.preventDefault();

    var id = parseInt($("#user_search").val());
    users_circles.selectAll("circle").style('fill', 'steelblue');
    var selected = users_circles.selectAll("circle").filter(function(d,i){ return parseInt(d3.select(this).attr("id")) == id}).style('fill', 'red').raise();

    if(selected.size() == 1){
        currentUser = id;
        currentMovie = null;
        update_current_selection_text();
        
        
        remove_saliency();
        user_clicked(id);
    }

    return false;
});
/********************************************************************************
  __  __    ___   __     __  ___   _____     ____       _      _   _   _____   _     
 |  \/  |  / _ \  \ \   / / |_ _| | ____|   |  _ \     / \    | \ | | | ____| | |    
 | |\/| | | | | |  \ \ / /   | |  |  _|     | |_) |   / _ \   |  \| | |  _|   | |    
 | |  | | | |_| |   \ V /    | |  | |___    |  __/   / ___ \  | |\  | | |___  | |___ 
 |_|  |_|  \___/     \_/    |___| |_____|   |_|     /_/   \_\ |_| \_| |_____| |_____|
                                                                                     
********************************************************************************/
var spinner_movie = new Spinner(opts).spin();
var movies_dataset;
var m_x;
var m_y;
var movieZone = {x: [0, 1000], y: [0, 600]};
var svg_movies = d3.select("#movie_div").append("svg")
    .attr("class", "svg movies_svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 " + movieZone.x[1] + " " + movieZone.y[1])
    .classed("svg-content-responsive", true);

 var movies_circles = svg_movies.append("g")
        .attr("class", "movies_circles");

var movies_paths = movies_circles.append("g")
    .attr("class", "line_paths");

var movies_green_path = movies_circles.append("g")
    .attr("class", "green_line_path");


spinner_movie.spin(target);
$.ajax({
    type: "GET",
    url: "http://127.0.0.1:8000/",
    dataType: 'json',
    data: {
        plot: 'movies',
    },
    success: function (newData) {
        movies_coord = newData;
        $.ajax({
            type: "GET",
            url: "http://127.0.0.1:8000/",
            dataType: 'json',
            data: {
                movie_titles: 1,
            },
            success: function (newData) {
                spinner_movie.stop();
                movies_titles_genres = newData;
                updateMovies();
            }
        });
    }
});

function updateMovies(){
    movies_dataset = [];
    movies_coord.forEach(function (val, i) {
        movies_dataset.push({
            'id': i,
            'x': movies_coord[i][0],
            'y': movies_coord[i][1],
            'title': movies_titles_genres[i].title,
            'genre': movies_titles_genres[i].genre
        })
    });



    m_x = d3.scaleLinear()
        .domain([d3.min(movies_coord, function (d) {
            return d[0];
        }), d3.max(movies_coord, function (d) {
            return d[0];
        })])
        .range([movieZone.x[0] + svg_padding, movieZone.x[1] - svg_padding]);

    m_y = d3.scaleLinear()
        .domain([d3.min(movies_coord, function (d) {
            return d[1];
        }), d3.max(movies_coord, function (d) {
            return d[1];
        })])
        .range([movieZone.y[1] - svg_padding, movieZone.y[0] + svg_padding]);


   


    movies_circles.selectAll("circle")
        .data(movies_dataset)
        .enter()
        .append("circle")
        .attr("cx", function (d) {
            return m_x(d.x);
        })
        .attr("cy", function (d) {
            return m_y(d.y);
        })
        .attr("r", 3)
        .attr("stroke", "#1573c1")
        .attr("stroke-width", 0.1)
        .attr("id", function (d) {
            return d.id;
        })
        .on('mouseover', function (d) {
            tip.setText("<div>" + d.id + "</div>" + "<div>" + d.title + "</div>" + "<div>" + d.genre + "</div>");
            tip.renderHtml();
            tip.show();

        })
        .on('mousedown', function (d) {
            currentMovie = d.id;
            update_current_selection_text();
            addPosterToTip(tip, d.title);
            if(currentUser!= null && currentItem !=null && currentMovie != null){
                movie_saliency( currentUser, currentItem, d.id);
            }
        })
        .on('mousemove', function (d) {
            tip.setPosition(d3.event.pageX, d3.event.pageY)
        })
        .on('mouseout', function (d) {
            tip.hide();
        });


    var zoom_movie = d3.zoom()
        .scaleExtent([1, 40])
        //.translateExtent([[-100, -100], [width + 90, height + 100]])
        .on("zoom", zoomed_movie);


    svg_movies.call(zoom_movie);
}

function zoomed_movie() {
    movies_circles.attr("transform", d3.event.transform);
}


function resetColorSizeMovies() {
    svg_movies.selectAll('circle')
        .style("fill", "steelblue")
        .style("r", 3)
        .on('mouseover', function (d) {
            tip.setText("<div>" + d.id + "</div>" + "<div>" + d.title + "</div>" + "<div>" + d.genre + "</div>");
            tip.renderHtml();
            tip.show();
        });
    movies_paths.selectAll("path").remove();
    movies_green_path.selectAll("path").remove();

}

function toggleGenre() {
    spinner_movie.spin(target);
    $.ajax({
        type: "GET",
        url: "http://127.0.0.1:8000/",
        dataType: 'json',
        data: {
            movie_genres_colors: 1,
        },
        success: function (newData) {
            movie_colors = newData;
            var svg_movies = d3.select(".movies_svg");
            svg_movies.selectAll('circle')
                .each(function (d) {
                    d3.select(this).transition()
                        .duration(400)
                        .style("fill", "" + movie_colors[d3.select(this).datum().id]);
                });
            genreToggled = true;
        },
        complete: function (data) {
            spinner_movie.stop();
        }
    });

}

function toggleBias() {
    spinner_movie.spin(target);
    $.ajax({
        type: "GET",
        url: "http://127.0.0.1:8000/",
        dataType: 'json',
        data: {
            movie_bias: 1,
        },
        success: function (newData) {
            movie_bias = newData;

            var scale = chroma.scale('RdYlBu').domain([d3.max(movie_bias), d3.min(movie_bias)]);
            var svg_movies = d3.select(".movies_svg");


            svg_movies.selectAll('circle')
                .each(function (d) {
                    var bias = movie_bias[d3.select(this).datum().id];
                    d3.select(this).transition()
                        .duration(400)
                        .style("fill",
                            scale(bias).hex()
                        );
                });
        },
        complete: function (data) {
            spinner_movie.stop();
        }
    });
}

function togglePopularity() {
    spinner_movie.spin(target);
    $.ajax({
        type: "GET",
        url: "http://127.0.0.1:8000/",
        dataType: 'json',
        data: {
            movie_popularity: 1,
        },
        success: function (newData) {


            movie_popularity = newData;

            var pop_values = new Array();
            for (var key in movie_popularity) {
                pop_values.push(Math.log(movie_popularity[key][1]));
            }

            var scale = chroma.scale('RdYlBu').domain([d3.max(pop_values), d3.min(pop_values)]);
            var svg_movies = d3.select(".movies_svg");


            svg_movies.selectAll('circle')
                .each(function (d) {
                    var popularity = Math.log(movie_popularity[d3.select(this).datum().id][1]);
                    d3.select(this).transition()
                        .duration(400)
                        .style("fill",
                            scale(popularity).hex()
                        );
                });

        },
        complete: function (data) {
            spinner_movie.stop();
        }
    });

}

function togglePaths() {
    if (pathsToggled){
        movies_paths.selectAll("path").remove();
        movies_green_path.selectAll("path").remove();
    }
    pathsToggled = !pathsToggled;
    if(currentUser != null){
        user_clicked(currentUser);
    }
}

var lastMovieTitle = "";
var lastImage= null;
var lastAjaxRequest = null;
function addPosterToTip(tip, movieTitle) {
    var division = movieTitle.match(/(.*)\ \(([0-9]+)\)$/);
    var title = division[1];
    var date = division[2];
    spinner_movie.spin(target);
    if(lastMovieTitle.localeCompare(movieTitle)==0){
        if(lastImage != null){
            tip.setImageSrc( lastImage);
            tip.renderHtml(image=true);
            spinner_movie.stop();
        }
    }else{
        lastMovieTitle = movieTitle;
        if(lastAjaxRequest != null){
            lastAjaxRequest.abort();
        }
        lastAjaxRequest = $.ajax({
            type: "GET",
            url: "http://www.omdbapi.com/",
            dataType: 'json',
            data: {
                s: title,
                y: date,
            },
            success: function (jsonData) {
                if(jsonData.Response == "True"){
                    //tip.html("<div>" + movieTitle + " </div>" + "<div>" + movieGenre + " </div> </br><img src='" + jsonData.Search[0].Poster + "' >");
                    lastImage =  jsonData.Search[0].Poster;
                    tip.setImageSrc(lastImage);
                    tip.renderHtml(image=true);
                }else{
                    lastImage = "";
                    tip.setImageSrc("");
                    tip.renderHtml();
                }


            },
            error: function (){
                lastImage = "";
                tip.setImageSrc("");
                tip.renderHtml();
            },
            complete: function (data) {
                spinner_movie.stop();
            },
        });
    }

}




/************************************************************************************************************
  ____       _      _       ___   _____   _   _    ____  __   __     ____   ____       _      ____    _   _ 
 / ___|     / \    | |     |_ _| | ____| | \ | |  / ___| \ \ / /    / ___| |  _ \     / \    |  _ \  | | | |
 \___ \    / _ \   | |      | |  |  _|   |  \| | | |      \ V /    | |  _  | |_) |   / _ \   | |_) | | |_| |
  ___) |  / ___ \  | |___   | |  | |___  | |\  | | |___    | |     | |_| | |  _ <   / ___ \  |  __/  |  _  |
 |____/  /_/   \_\ |_____| |___| |_____| |_| \_|  \____|   |_|      \____| |_| \_\ /_/   \_\ |_|     |_| |_|
                                                                                                            
************************************************************************************************************/

var spinner_saliency = new Spinner(opts).spin();

var saliencyZone = {x: [0, 2000], y: [0, 150]}

var saliency_x = d3.scaleLinear().range([saliencyZone.x[0] + svg_padding, saliencyZone.x[1] - svg_padding]);
var saliency_y = d3.scaleLinear().range([saliencyZone.y[1] - svg_padding, saliencyZone.y[0] + svg_padding]);

/*var valueline = d3.line()
    .x(function(d,i) { return saliency_x(i/30.0)+saliency_x(1)/60; })
  .y(function(d, i, array) { return saliency_y(d/ d3.max(array)); }); */ 

var valueline = d3.line()
    .x(function(d,i) { return saliency_x(i); })
    .y(function(d, i) { return saliency_y(d); });


var svg_saliency = d3.select("#saliency_div").append("svg")                      
        .attr("class", "svg saliency_svg")
        .attr("preserveAspectRatio", "xMinYMin meet")
        .attr("viewBox", "0 0 " + saliencyZone.x[1] + " " + saliencyZone.y[1])
        .classed("svg-content-responsive", true)
    .append("g")
        .attr("class", "saliency_graph");

var group_y_axis = svg_saliency.append("g").attr("transform", "translate( " + svg_padding + ", 0 )");
var group_legend = svg_saliency.append("g").attr("transform", "translate( " + saliency_x(0.04) + ", "+saliency_y(0.8) +" )");

function remove_saliency() {
    svg_saliency.selectAll("path").remove();
}

function movie_saliency(user_id, sequence_id, movie_id) {
    spinner_saliency.spin(target);
    $.ajax({
        type: "GET",
        url: "http://127.0.0.1:8000/",
        dataType: 'json',
        data: {
            user_saliency: user_id,
            movie_id: movie_id,
            sequence_id: sequence_id,
        },
        success: function (jsonData) {

            console.log(jsonData);
            saliency_x.domain([0,29]);
            saliency_y.domain([d3.min(jsonData.max.concat(jsonData.mean)),d3.max(jsonData.max.concat(jsonData.mean))]);

            

            console.log(jsonData);
            var line_path_max = svg_saliency
                    .selectAll("path.max")
                    .data([jsonData.max]);

            line_path_max.enter()
                .append("svg:path")
                .merge(line_path_max)
                .attr("class", "line max")
                .attr("d", valueline)
                .style("stroke", "orange");

            line_path_max.exit().remove();

            var line_path_mean = svg_saliency
                    .selectAll("path.mean")
                    .data([jsonData.mean]);

            line_path_mean.enter()
                .append("svg:path")
                .merge(line_path_mean)
                .attr("class", "line mean")
                .attr("d", valueline)
                .style("stroke", "white");

            line_path_mean.exit().remove();

            group_y_axis.call(d3.axisLeft(saliency_y)
                            .ticks(5)
                            .tickFormat(d3.format(".2f")));

            var ordinal = d3.scaleOrdinal()
              .domain(["max", "mean"])
              .range([ "#ffa500", "#ffffff"]);

            var legendOrdinal = d3.legendColor()
              .shape("path", d3.symbol().type(d3.symbolSquare).size(150)())
              .shapePadding(0)
              .cellFilter(function(d){ return d.label })
              .scale(ordinal);

            group_legend.call(legendOrdinal);

        },
        complete: function (data) {
            spinner_saliency.stop();
        },
    });
}

/************************************************************************************************************
  _   _   _____   _   _   ____     ___    _   _     _   _   _____      _      _____   __  __      _      ____  
 | \ | | | ____| | | | | |  _ \   / _ \  | \ | |   | | | | | ____|    / \    |_   _| |  \/  |    / \    |  _ \ 
 |  \| | |  _|   | | | | | |_) | | | | | |  \| |   | |_| | |  _|     / _ \     | |   | |\/| |   / _ \   | |_) |
 | |\  | | |___  | |_| | |  _ <  | |_| | | |\  |   |  _  | | |___   / ___ \    | |   | |  | |  / ___ \  |  __/ 
 |_| \_| |_____|  \___/  |_| \_\  \___/  |_| \_|   |_| |_| |_____| /_/   \_\   |_|   |_|  |_| /_/   \_\ |_|    
                                                                                                               
***********************************************************************************************************/

var sequenceZone = {x: [0, 2000], y: [0, 250]}

var svg_sequences = d3.select("#sequence_div").append("svg")
    .attr("class", "svg sequence_svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 " + sequenceZone.x[1] + " " + sequenceZone.y[1])
    .classed("svg-content-responsive", true);


var s_x = d3.scaleLinear()
    .range([sequenceZone.x[0] + svg_padding, sequenceZone.x[1] - svg_padding]);

var s_y = d3.scaleLinear()
    .range([sequenceZone.y[1] - svg_padding, sequenceZone.y[0] + svg_padding]);

var sequence_heatmap = svg_sequences.append("g")
    .attr("class", "sequence_heatmap");



function displayNeuronHeatmap(heatmap, sequence_prediction) {
    if (currentItem > heatmap.length - 1) {
        currentItem = heatmap.length - 1;
    }
    var value_array = []
    heatmap.forEach(
        function (item, i) {
            item.forEach(
                function (neuron, j) {
                    //value_array.push(Math.abs(neuron))
                    value_array.push(neuron)
                }
            )
        }
    );
    var previousItem = null;
    var c_scale = chroma.scale('RdYlBu').domain([d3.max(value_array), d3.min(value_array)]);
    sequence_heatmap.selectAll("g").remove();
    s_x.domain([0,30])
    var rectangleWidth = (s_x.range()[1]-s_x.range()[0]) / (30)
    var rectangleHeight  = (s_y.range()[0]-s_y.range()[1]) / (heatmap[0].length)
    heatmap.forEach(
        function(item, i){
            
            s_y.domain([0,50])

            var item_group = sequence_heatmap.append("g").attr("transform", "translate("+s_x(i)+","+0+")")
                                                            .attr("class","sequence_item i"+i);
            item_group.on('mouseover', function () {
                addPosterToTip(tip, movies_titles_genres[sequence_prediction.init_sequence[i]].title);
                previousItem  = i;
            });

            var neurons = item_group
                .selectAll('rect')
                .data(item);

            neurons.enter().append('rect')
                .merge(neurons)
                .attr("x", function (d, j) {
                    return 0;
                })
                .attr("y", function (d, j) {
                    return s_y(j+1);
                })
                .attr("width",rectangleWidth)
                .attr("height", rectangleHeight)
                .attr("fill", function (d, j) {
                    return c_scale(d).hex()
                    //return c_scale(Math.abs(d)).hex()

                })
                .on('mousedown', function (d, j) {
                    currentItem = i;
                    update_current_selection_text();
                    updateCurrentItemDisplayV2(i, rectangleWidth, rectangleHeight);
                    var item = sequence_prediction.predictions[i];
                    highlight_prediction(item.prediction, sequence_prediction.predictions);
                    highlight_init_sequence(sequence_prediction.init_sequence.slice(0, i + 1), sequence_prediction.goals)
                })
                .on('mouseover', function (d,j) {
                    tip.show();
                    tip.setText("<div> item: " + i + "</div>" + "<div> neuron: " + j
                        + "</div><div>" + d + "</div> <div>input: "
                        + movies_titles_genres[sequence_prediction.init_sequence[i]].title
                        + " ::: " + movies_titles_genres[sequence_prediction.init_sequence[i]].genre
                        + "</div> <div>id: " + sequence_prediction.init_sequence[i] + " </div>");
                    tip.renderHtml();
                })
                .on('mousemove', function (d) {
                    tip.setPosition(d3.event.pageX, d3.event.pageY)
                })
                .on('mouseout', function (d) {
                    tip.hide();
                });

                neurons.exit().remove();                   
        });
     updateCurrentItemDisplayV2(currentItem, rectangleWidth, rectangleHeight);
    //console.log(flat_array);

    var zoom_neuron = d3.zoom()
    .scaleExtent([1, 40])
    //.translateExtent([[-100, -100], [width + 90, height + 100]])
    .on("zoom", zoomed_neuron);

    svg_sequences.call(zoom_neuron);

}

function zoomed_neuron() {
    sequence_heatmap.attr("transform", d3.event.transform);
}

function highlight_prediction(prediction, all_predictions) {
    // Enable sequence-wise scale for predixtion radius.
    //flat = [];
    //all_predictions.forEach(function(item,i){flat = flat.concat(item.prediction)});
    var sizeScale = d3.scalePow().domain([d3.min(prediction), d3.max(prediction)]).range([1, 15]);
    svg_movies.selectAll('circle')
        .on('mouseover', function (d) {
                    tip.setText("<div> <b> output:"+ prediction[d3.select(this).datum().id] +"</b></div><div>" + d.id + "</div>" + "<div>" + d.title + "</div>" + "<div>" + d.genre + "</div>");
                    tip.renderHtml();
                    tip.show();
                })
        .each(function (d) {
            d3.select(this)
                .transition()
                .duration(300)
                .style("r", sizeScale(prediction[d3.select(this).datum().id]))
                

        });


}

function highlight_init_sequence(init_sequence, goals) {

    svg_movies.selectAll("circle").style('fill', 'steelblue');
    svg_movies.selectAll('circle')
        .each(function (d) {
            elem = d3.select(this);
            if ($.inArray(elem.datum().id, init_sequence) != -1) {
                elem.style("fill", "red")
                    .raise();
            };
            if (elem.datum().id == goals[init_sequence.length - 1]) {
                elem.style("fill", "#00ff00")
                    .raise();
            };
            if (goals.slice(init_sequence.length).includes(elem.datum().id)) {
                elem.style("fill", "#FF9908")
                    .raise();
            }; 

        });

    if(pathsToggled){
        var line = d3.line()
            .x(function (d, i) {
                return m_x(d.x);
            })
            .y(function (d, i) {
                return m_y(d.y)
            });

        line_data = [];
        for (var i = 0; i < init_sequence.length; i++) {
            movie_id = init_sequence[i];
            line_data.push({x: movies_dataset[movie_id].x, y: movies_dataset[movie_id].y});
        }
        line_paths = movies_paths.selectAll("path.main").data([line_data]);
        line_paths.enter()
            .append("path")
            .merge(line_paths)
            .attr("class", "main")
            .attr("d", line)
            ;
        line_paths.exit().remove();
        line_paths.raise();

        green_line_data = [];
        green_line_data.push({
            x: movies_dataset[init_sequence[init_sequence.length - 1]].x,
            y: movies_dataset[init_sequence[init_sequence.length - 1]].y
        })
        green_line_data.push({
            x: movies_dataset[goals[init_sequence.length - 1]].x,
            y: movies_dataset[goals[init_sequence.length - 1]].y
        })
        green_line_path = movies_green_path.selectAll("path.green").data([green_line_data]);
        green_line_path.enter()
            .append("path")
            .merge(green_line_path)
            .attr("class", "green")
            .attr("d", line);
        green_line_path.exit().remove();
    }

}



function updateCurrentItemDisplayV2(value, width, height){
    currentItem = value;
    update_current_selection_text();
    group = sequence_heatmap.selectAll(".i"+value);
    super_group = sequence_heatmap;
    super_group.selectAll("rect.selection").remove();
    var rect = group.append("rect")
            .attr("x", 0)
            .attr("y", s_y(50) -3)
            .attr("width", width)
            .attr("height", height*50 +6 )
            .attr("class", "selection")
            .attr("fill", "none")
            .attr("stroke", "red")
            .attr("stroke-width", "6px")
            .attr("stroke-location", "outside");
    group.raise();
    rect.raise();
}

/************************************************************************************************************
   ____      _      _____   _____     _   _   _____      _      _____   __  __      _      ____  
  / ___|    / \    |_   _| | ____|   | | | | | ____|    / \    |_   _| |  \/  |    / \    |  _ \ 
 | |  _    / _ \     | |   |  _|     | |_| | |  _|     / _ \     | |   | |\/| |   / _ \   | |_) |
 | |_| |  / ___ \    | |   | |___    |  _  | | |___   / ___ \    | |   | |  | |  / ___ \  |  __/ 
  \____| /_/   \_\   |_|   |_____|   |_| |_| |_____| /_/   \_\   |_|   |_|  |_| /_/   \_\ |_|    
                                                                                                 
***********************************************************************************************************/

var updateGateZone = {x: [0, 2000], y: [0, 150]}
var resetGateZone = {x: [0, 2000], y: [0, 150]}
var candidateGateZone = {x: [0, 2000], y: [0, 150]}

var svg_updateGate = d3.select("#updateGate_div").append("svg")
    .attr("class", "svg updateGate_svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 " + updateGateZone.x[1] + " " + updateGateZone.y[1])
    .classed("svg-content-responsive", true);

var svg_resetGate = d3.select("#resetGate_div").append("svg")
    .attr("class", "svg resetGate_svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 " + resetGateZone.x[1] + " " + resetGateZone.y[1])
    .classed("svg-content-responsive", true);

var svg_candidateGate = d3.select("#candidateGate_div").append("svg")
    .attr("class", "svg candidateGate_svg")
    .attr("preserveAspectRatio", "xMinYMin meet")
    .attr("viewBox", "0 0 " + candidateGateZone.x[1] + " " + candidateGateZone.y[1])
    .classed("svg-content-responsive", true);

var G_x = d3.scaleLinear()
    .domain([0, 1])
    .range([updateGateZone.x[0] + svg_padding, updateGateZone.x[1] - svg_padding]);

var G_y = d3.scaleLinear()
    .domain([0, 1])
    .range([updateGateZone.y[1] - svg_padding, updateGateZone.y[0] + svg_padding]);

var updateGate_heatmap = svg_updateGate.append("g")
    .attr("class", "updateGate_heatmap");

var resetGate_heatmap = svg_resetGate.append("g")
    .attr("class", "resetGate_heatmap");

var candidateGate_heatmap = svg_candidateGate.append("g")
    .attr("class", "candidateGate_heatmap");

function displayUpdateGateHeatmap(update_gate_data) {

    var flat_array = []
    var value_array = []
    update_gate_data.forEach(
        function (item,i) {
            item.forEach(
                function (value,j) {
                    flat_array.push(
                        {
                            item: i,
                            neuron: j,
                            value: value,
                        }
                    );
                    value_array.push(Math.abs(value))
                }
            )
        }
    );
    var c_scale = chroma.scale('RdYlBu').domain([1, 0]);

    var gateValues = updateGate_heatmap
        .selectAll('rect')
        .data(flat_array);

    gateValues.enter().append('rect')
        .merge(gateValues)
        .attr("x", function (d, i) {
            return G_x(d.item / 30);
        })
        .attr("y", function (d, i) {
            return G_y(d.neuron / 50);
        })
        .attr("width", G_x(1) / 30)
        .attr("height", G_y(0) / 50)
        .attr("fill", function (d, i) {
            return c_scale(Math.abs(d.value)).hex()
        });

    gateValues.exit().remove();

}

function displayResetGateHeatmap(reset_gate_data) {

    var flat_array = []
    var value_array = []
    reset_gate_data.forEach(
        function (item,i) {
            item.forEach(
                function (value,j) {
                    flat_array.push(
                        {
                            item: i,
                            neuron: j,
                            value: value,
                        }
                    );
                    value_array.push(Math.abs(value))
                }
            )
        }
    );
    var c_scale = chroma.scale('RdYlBu').domain([1, 0]);

    var gateValues = resetGate_heatmap
        .selectAll('rect')
        .data(flat_array);

    gateValues.enter().append('rect')
        .merge(gateValues)
        .attr("x", function (d, i) {
            return G_x(d.item / 30);
        })
        .attr("y", function (d, i) {
            return G_y(d.neuron / 50);
        })
        .attr("width", G_x(1) / 30)
        .attr("height", G_y(0) / 50)
        .attr("fill", function (d, i) {
            return c_scale(Math.abs(d.value)).hex()
        });

    gateValues.exit().remove();

}

function displayCandidateGateHeatmap(candidate_gate_data) {

    var flat_array = []
    var value_array = []
    candidate_gate_data.forEach(
        function (item,i) {
            item.forEach(
                function (value,j) {
                    flat_array.push(
                        {
                            item: i,
                            neuron: j,
                            value: value,
                        }
                    );
                    value_array.push(Math.abs(value))
                }
            )
        }
    );
    var c_scale = chroma.scale('RdYlBu').domain([1,0]);

    var gateValues = candidateGate_heatmap
        .selectAll('rect')
        .data(flat_array);

    gateValues.enter().append('rect')
        .merge(gateValues)
        .attr("x", function (d, i) {
            return G_x(d.item / 30);
        })
        .attr("y", function (d, i) {
            return G_y(d.neuron / 50);
        })
        .attr("width", G_x(1) / 30)
        .attr("height", G_y(0) / 50)
        .attr("fill", function (d, i) {
            return c_scale(Math.abs(d.value)).hex()
        });

    gateValues.exit().remove();

}