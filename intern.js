/*
 * Copyright (C) 2012 John Krauss
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included
 * in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE,
 * ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 */

/*jslint browser: true, vars: true, nomen: true, plusplus: true*/
/*globals $, d3*/

(function () {
    "use strict";
    var QUESTIONS_LOCATION = "data/questions.tsv",
        VERSION = "1",
        FIRST_QUESTION = "1",
        BUTTON_COLUMNS = ['Yes', 'No', "Not sure"],
        MESSAGE_COLUMN = 'Message',
        BUTTON_CLASSES = 'btn btn-large',
        BUTTON_TEMPLATE = '<button class="' + BUTTON_CLASSES + '" />',
        RECORD_HOST = 'http://intern-labor-survey.herokuapp.com/',
        RECORD_ENDPOINT = '',
        $question = $('#question'),
        $choices = $('#choices'),
        $endgame = $('#endgame'),
        $reset = $('#reset a'),
        lastRow = 0,
        m = [20, 120, 20, 120],
        w = 1280 - m[1] - m[3],
        h = 800 - m[0] - m[2],
        root,
        tree = d3.layout.tree()
            .size([h, w]),
        diagonal = d3.svg.diagonal()
            .projection(function (d) { return [d.y, d.x]; }),
        vis = d3.select("#flowchart").append("svg:svg")
            .attr("width", w + m[1] + m[3])
            .attr("height", h + m[0] + m[2])
            .append("svg:g")
            .attr("transform", "translate(" + m[3] + "," + m[0] + ")"),

        /**
         * Display the endgame scenario.
         */
        endgame = function () {
            $endgame.show();
        },

        /**
         * Input is a raw multi-line TSV as a string.  Output is a JSON
         * object with the first column used as the key for the hash.
         */
        parseTSV = function (tsv) {
            var parsed = {},
                rows = tsv.split('\n'),
                header = rows.shift().split('\t');
            $.each(rows, function (i, row) {
                var cols = row.split('\t'),
                    question = {};
                $.each(cols, function (i, col) {
                    question[header[i]] = col;
                });
                // assume first data column is ID
                parsed[cols[0]] = question;
            });
            return parsed;
        },

        /**
         * Use the #size-area div to sample the dimensions required for some
         * text.  .
         */
        testOuterDimensions = function (text, classes) {
            var $parent = $('#size-area'),
                $testDiv = $('<div />')
                    .text(text)
                    .addClass(classes)
                    .appendTo($parent),
                dimensions = {
                    width: $parent.outerWidth(),
                    height: $parent.outerHeight()
                };
            $testDiv.remove();
            return dimensions;
        },

        /**
         * Convert questions to a tree.
         */
        asTree = function (questions, question) {
            if (!question.dim) {
                question.dim = testOuterDimensions(question.Message, 'answer well glow');
            }
            var node = {
                id: question.ID,
                dim: question.dim,
                children: [],
                message: question.Message
            }, i, b;

            for (i = 0; i < BUTTON_COLUMNS.length; i += 1) {
                b = BUTTON_COLUMNS[i];
                if (question[b] && questions.hasOwnProperty(question[b])) {
                    node.children.push(asTree(questions, questions[question[b]]));
                }
            }

            return node;
        },

        /**
         * Record the response to a question.
         */
        record = function (question, button) {
            $.ajax({
                url: RECORD_HOST + RECORD_ENDPOINT,
                data: {q: question, a: button, v: VERSION},
                crossDomain: true
            });
        },

        /**
         * Ask a question.
         */
        ask = function (id, questions) {
            var question = questions[id];
            $question.text(question[MESSAGE_COLUMN]);
            $choices.empty();
            $.each(BUTTON_COLUMNS, function (i, button) {
                var nextId = question[button];
                if (nextId !== '') {
                    $(BUTTON_TEMPLATE)
                        .text(button)
                        .on('click', function () {
                            record(question[MESSAGE_COLUMN], button);
                            ask(nextId);
                            // show the reset button after any click.
                            $reset.fadeIn();
                        }).appendTo($choices);
                }
            });
            if ($choices.is(':empty')) {
                endgame();
            }
        },

        /**
         * Start the questionnaire.
         */
        start = function (first_question, questions) {
            // hide the reset button at start
            $reset.fadeOut();
            $endgame.hide();
            ask(first_question, questions);
        },

        // Toggle children.
        toggle = function (d) {
            if (d.children) {
                d._children = d.children;
                d.children = null;
            } else {
                d.children = d._children;
                d._children = null;
            }
        },

        update = function (source) {
            var duration = d3.event && d3.event.altKey ? 5000 : 500;

            // Compute the new tree layout.
            var nodes = tree.nodes(root).reverse();

            // Normalize for fixed-depth.
            nodes.forEach(function (d) { d.y = d.depth * 180; });

            // Update the nodes…
            var node = vis.selectAll("g.node").data(nodes, function (d) { return d.id; });

            // Enter any new nodes at the parent's previous position.
            var nodeEnter = node.enter().append("svg:g")
                .attr("class", "node")
                .attr("transform", function (d) { return "translate(" + source.y0 + "," + source.x0 + ")"; })
                .on("click", function (d) { toggle(d); update(d); });

            nodeEnter.append("svg:circle")
                .attr("r", 1e-6)
                .style("fill", function (d) { return d._children ? "lightsteelblue" : "#fff"; });

            nodeEnter.append("svg:text")
                .attr("x", function (d) { return d.children || d._children ? -10 : 10; })
                .attr("dy", ".35em")
                .attr("text-anchor", function (d) { return d.children || d._children ? "end" : "start"; })
                .text(function (d) { return d.message; })
                .style("fill-opacity", 1e-6);

            // Transition nodes to their new position.
            var nodeUpdate = node.transition()
                .duration(duration)
                .attr("transform", function (d) { return "translate(" + d.y + "," + d.x + ")"; });

            nodeUpdate.select("circle")
                .attr("r", 4.5)
                .style("fill", function (d) { return d._children ? "lightsteelblue" : "#fff"; });

            nodeUpdate.select("text")
                .style("fill-opacity", 1);

            // Transition exiting nodes to the parent's new position.
            var nodeExit = node.exit().transition()
                .duration(duration)
                .attr("transform", function (d) { return "translate(" + source.y + "," + source.x + ")"; })
                .remove();

            nodeExit.select("circle")
                .attr("r", 1e-6);

            nodeExit.select("text")
                .style("fill-opacity", 1e-6);

            // Update the links…
            var link = vis.selectAll("path.link")
                .data(tree.links(nodes), function (d) { return d.target.id; });

            // Enter any new links at the parent's previous position.
            link.enter().insert("svg:path", "g")
                .attr("class", "link")
                .attr("d", function (d) {
                    var o = {x: source.x0, y: source.y0};
                    return diagonal({source: o, target: o});
                })
                .transition()
                .duration(duration)
                .attr("d", diagonal);

            // Transition links to their new position.
            link.transition()
                .duration(duration)
                .attr("d", diagonal);

            // Transition exiting nodes to the parent's new position.
            link.exit().transition()
                .duration(duration)
                .attr("d", function (d) {
                    var o = {x: source.x, y: source.y};
                    return diagonal({source: o, target: o});
                })
                .remove();

            // Stash the old positions for transition.
            nodes.forEach(function (d) {
                d.x0 = d.x;
                d.y0 = d.y;
            });
        },



            /*answers.enter()
                .append('g')
                .classed('answer', true)
                .attr('transform', function (d) { return 'translate(' +
                    d.left + ',' + addParents(d) + ')'; })
                .each(function (d, i) {
                    var question = d.Message,
                        el = d3.select(this);

                    //d.el = el;
                    if (question) {
                        el.append('svg:foreignObject').attr({
                            width: d.dim.width,
                            height: d.dim.height,
                        }).append('xhtml:body').style({
                            padding: '0px',
                            margin: '0px'
                        }).attr({
                        }).append('div')
                            .classed('well answer glow', true)
                            .text(d.Message);
                    }
                });*/

            /*links.enter()
                .append('path')
                .classed('line', true)
                .attr('d', function (d, i) {
                    var foo = d3.svg.line().interpolate("cardinal")
                        .x(function (d) { return d.x; })
                        .y(function (d) { return d.y; });
                    if (d.from && d.to) {
                        return foo([{
                            x: d.from.left + (d.from.dim.width / 2),
                            y: d.from.top + d.from.dim.height - 20
                        }, {
                            x: d.to.left + (d.to.dim.width / 2),
                            y: d.to.top
                        }]);
                    } else {
                        return foo([]);
                    }
                });*/

            //answers.exit().remove();

        /**
         * Draw the flowchart visualization.
         */
        visualize = function (first_question, questions) {
            /*var svg = d3.select($('#flowchart')[0]).append('svg')
                .attr({
                    'xmlns': 'http://www.w3.org/2000/svg',
                    'height': '2000px',
                    'width': '2000px'
                }),*/
            //links = svg.selectAll('.links').data(linksFromTree(tree)),
            //answers = svg.selectAll('.answers').data(tree);
            /*
            d3.json("flare.json", function(json) {
                root = json;
                root.x0 = h / 2;
                root.y0 = 0;
            }
            */
            root = asTree(questions, questions[first_question]);
            root.x0 = h / 2;
            root.y0 = 0;
            function toggleAll(d) {
                if (d.children) {
                    d.children.forEach(toggleAll);
                    toggle(d);
                }
            }

            // Initialize the display to show
            // a few nodes.
            root.children.forEach(toggleAll);
            update(root);
        };

    // load questions
    $.get(QUESTIONS_LOCATION).done(function (resp) {
        // stateful
        var questions = parseTSV(resp);
        start(FIRST_QUESTION, questions);
        visualize(FIRST_QUESTION, questions);
        $reset.on('click', start);
    });
}());
