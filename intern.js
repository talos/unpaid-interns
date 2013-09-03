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
        DEMOGRAPHICS_LOCATION = "data/demographics.tsv",
        VERSION = "1",
        FIRST_QUESTION = "1",
        BUTTON_COLUMNS = ['Yes', 'No', "Not sure"],
        MESSAGE_COLUMN = 'Message',
        BUTTON_CLASSES = 'btn btn-large',
        BUTTON_TEMPLATE = '<button class="' + BUTTON_CLASSES + '" />',
        RECORD_HOST = 'http://intern-labor-survey.herokuapp.com/',
        RECORD_ENDPOINT = '',
        $intro = $('#intro'),
        $question = $('#question').hide(),
        $doSurvey = $('.do-survey'),
        $demographics = $('#demographics').hide(),
        $demographicsQuestions = $('#demographics #questions'),
        $thanks = $('#thanks').hide(),
        $choices = $('#choices'),
        $endgame = $('#endgame'),
        $reset = $('#reset a'),
        width = 1300,
        height = 3000,
        svg = d3.select('body')
            .append('svg')
            .attr('width', width)
            .attr('height', height),
        $start = $('#start a'),
        $submit = $('#submit a'),
        questions,
        demographics,

        /**
         * Display the endgame scenario.
         */
        endgame = function (id) {
            $question.hide();
            $doSurvey.show();
            //$reset.hide();
            $('#' + id).show().parents().show();
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
         * Convert questions to nodes and links (returned as two-tuple).
         */
        toNodesAndLinks = function (questions, firstQuestion) {
            var nodesAry = [],
                nodesObj = {},
                links = [],
                linksObj = {},
                numTerm = 0,
                makeNode = function (k) {
                    var q = questions[k] || {
                        ID: k,
                        Message: k
                    },
                        node = nodesObj[k],
                        target,
                        link,
                        i,
                        r,
                        b;
                    if (!node) {
                        node = {
                            id: q.ID,
                            dim: testOuterDimensions(q.Message, 'foreign'),
                            text: q.Message,
                            y: 0,
                            x: width / 2,
                            from: [],
                            to: []
                        };

                        // Fix first node at top
                        if (k === firstQuestion) {
                            node.x = width / 2;
                            node.fixed = true;
                        }

                        node.radius = Math.sqrt(Math.pow(node.dim.width, 2) +
                                                Math.pow(node.dim.height, 2));
                        node.angle = Math.atan(node.dim.height / node.dim.width) * 180 / Math.PI;
                        nodesObj[k] = node;
                        nodesAry.push(node);
                    }
                    for (i = 0; i < BUTTON_COLUMNS.length; i += 1) {
                        b = BUTTON_COLUMNS[i];
                        if (q[b]) {
                            if (!linksObj[node.id + '=>' + q[b]]) {
                                target = makeNode(q[b]);
                                link = {
                                    source: node,
                                    target: target,
                                    text: b
                                };
                                node.to.push(link);
                                target.from.push(link);
                                links.push(link);
                                linksObj[node.id + '=>' + q[b]] = true;
                            }
                        }
                    }
                    return node;
                };

            makeNode(firstQuestion);

            return [nodesAry, links];
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
            $('.text', $question).text(question[MESSAGE_COLUMN]);
            $choices.empty();
            $.each(BUTTON_COLUMNS, function (i, button) {
                var nextId = question[button];
                if (nextId !== '') {
                    $(BUTTON_TEMPLATE)
                        .text(button)
                        .on('click', function () {
                            record(question[MESSAGE_COLUMN], button);
                            if (questions[nextId]) {
                                ask(nextId);
                            } else {
                                endgame(nextId);
                            }
                        }).appendTo($choices);
                }
            });

            if ($choices.is(':empty')) {
                endgame();
            }
        },

        collide = function (node) {
            var rDiv = 2,
                r = node.radius / rDiv,
                nx1 = node.x - r,
                nx2 = node.x + r,
                ny1 = node.y - r,
                ny2 = node.y + r;
            return function (quad, x1, y1, x2, y2) {
                if (quad.point && (quad.point !== node)) {
                    var x = node.x - quad.point.x,
                        y = node.y - quad.point.y,
                        l = Math.sqrt(x * x + y * y),
                        r = node.radius / rDiv + quad.point.radius / rDiv;
                    if (l < r) {
                        l = (l - r) / (l || 1) * 0.5;
                        node.x -= x *= l;
                        node.y -= y *= l;
                        quad.point.x += x;
                        quad.point.y += y;
                    }
                }
                return x1 > nx2
                    || x2 < nx1
                    || y1 > ny2
                    || y2 < ny1;
            };
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

        /**
         * Draw the flowchart visualization.
         */
        visualize = function (first_question, questions) {
            var nodesAndLinks = toNodesAndLinks(questions, first_question),
                nodes = nodesAndLinks[0],
                links = nodesAndLinks[1],

                // handles to link and node element groups
                circle = svg.append('svg:g').selectAll('g'),
                path = svg.append('svg:g').selectAll('path'),
                t = 0,

                // determine whether `source` is the last source in `target`.
                isLastSource = function (source, target) {
                    var i;
                    for (i = 0; i < target.from.length; i += 1) {
                        if (target.from[i].id > source.id) {
                            return false;
                        }
                    }
                    return true;
                },

                // update force layout (called automatically each iteration)
                tick = function () {
                    var i,
                        j,
                        n,
                        f,
                        t0,
                        t1,
                        cwidth,
                        lowest,
                        padding = 25,
                        possibleY,
                        len = nodes.length;

                    for (i = 0; i < len; i += 1) {
                        n = nodes[i];

                        // Prevent vertical overlap
                        for (j = 0; j < n.to.length; j += 1) {
                            if (isLastSource(n, n.to[j].target)) {
                                possibleY = n.y + n.dim.height + padding;
                                n.to[j].target.y = possibleY > n.to[j].target.y ? possibleY : n.to[j].target.y;
                            }
                        }

                        cwidth = 0;
                        for (j = 0; j < n.to.length; j += 1) {
                            if (isLastSource(n, n.to[j].target)) {
                                cwidth += n.to[j].target.dim.width + padding;
                            }
                        }

                        if (cwidth > 0) { // everything wasn't last source, or no targets
                            cwidth -= padding;

                            n.to[0].target.x = n.x + (n.dim.width / 2) - (cwidth / 2);

                            // Don't allow children to overlap horizontally
                            t1 = null;
                            t0 = null;
                            for (j = 0; j < n.to.length; j += 1) {
                                t1 = n.to[j].target;
                                if (isLastSource(n, t1)) {
                                    if (t1 && t0) {
                                        t1.x = t0.x + t0.dim.width + padding;
                                    }
                                    t0 = t1;
                                } else {
                                    t1 = null;
                                }
                            }
                        }
                    }

                    var q = d3.geom.quadtree(nodes);
                    for (i = 0; i < 10; i += 1) {
                        for (j = 0; j < nodes.length; j += 1) {
                            q.visit(collide(nodes[j]));
                        }
                    }

                    circle.attr('transform', function (d) {
                        return 'translate(' + d.x + ',' + d.y + ')';
                    });
                    /*circle.attr("cx", function (d) { return d.x; })
                        .attr("cy", function (d) { return d.y; });*/

                    path.attr('d', function (d) {

                        var sourceX = d.source.x + d.source.dim.width / 2,
                            sourceY = d.source.y + d.source.dim.height / 2,
                            targetX = d.target.x + d.target.dim.width / 2,
                            targetY = d.target.y + d.target.dim.height / 2,
                            sourceAngle = d.source.angle,
                            targetAngle = d.target.angle,

                            theta = Math.atan((targetY - sourceY) / (targetX - sourceX)),
                            angle = theta * 180 / Math.PI;
                            //invert = (targetX - sourceX) * (targetY - sourceY) < 0 ? -1 : 1;
                            //invert = targetX - sourceX < 0 && targetY - sourceY < 0 ? -1 : 1;
                            //invertSource = ?,
                            //invertTarget = ?;

                        if (angle < sourceAngle && angle > -sourceAngle) {
                            sourceX += d.source.dim.width / 2 * (targetX - sourceX < 0 ? -1 : 1);
                        } else {
                            sourceY += d.source.dim.height / 2 * (targetY - sourceY < 0 ? -1 : 1);
                        }

                        if (angle < targetAngle && angle > -targetAngle) {
                            targetX += d.target.dim.width / 2 * (targetX - sourceX < 0 ? 1 : -1);
                        } else {
                            targetY += d.target.dim.height / 2 * (targetY - sourceY < 0 ? 1 : -1);
                        }

                        return 'M' + sourceX + ',' + sourceY + 'L' + targetX + ',' + targetY;
                    });

                    t += 1;
                    return t > 0;
                };

            // define arrow markers for graph links
            svg.append('svg:defs').append('svg:marker')
                .attr('id', 'end-arrow')
                .attr('viewBox', '0 -5 10 10')
                .attr('refX', 6)
                .attr('markerWidth', 3)
                .attr('markerHeight', 3)
                .attr('orient', 'auto')
                .append('svg:path')
                .attr('d', 'M0,-5L10,0L0,5')
                .attr('fill', '#000');

            // path (link) group
            path = path.data(links);

            // add new links
            path.enter().append('svg:path')
                .attr('class', 'link')
                .style('marker-end', 'url(#end-arrow)')
                .each(function (d) {
                    d.el = d3.select(this);
                })

            // add text for links
                .append('svg:text')
                .text('foo');
            /*g.append('svg:text')
                .attr('x', 0)
                .attr('y', 4)
                .attr('class', 'id')
                .text(function (d) { return d.text; });*/

            // remove old links
            path.exit().remove();

            // circle (node) group
            // NB: the function arg is crucial here! nodes are known by id, not by index!
            circle = circle.data(nodes, function (d) { return d.id; });

            // add new nodes
            var g = circle.enter().append('svg:g');

            g.append('svg:rect')
                .attr('class', 'node')
                .attr('width', function (d) { return d.dim.width; })
                .attr('height', function (d) { return d.dim.height; });
                //.attr('r', function (d) { return d.dim.width / 2; });

            g.append('svg:foreignObject')
                .attr('width', function (d) { return d.dim.width; })
                .attr('height', function (d) { return d.dim.height; })
                .on('mouseover', function (d) {
                    var i, j, classes = ['from', 'to'];
                    for (i = 0; i < classes.length; i += 1) {
                        for (j = 0; j < d[classes[i]].length; j += 1) {
                            d[classes[i]][j].el.classed(classes[i], true);
                        }
                    }
                })
                .on('click', function (d) {
                    console.log(d);
                })
                .on('mouseout', function (d) {
                    var i, j, classes = ['from', 'to'];
                    for (i = 0; i < classes.length; i += 1) {
                        for (j = 0; j < d[classes[i]].length; j += 1) {
                            d[classes[i]][j].el.classed(classes[i], false);
                        }
                    }
                })
                //.attr('x', function (d) { return -d.dim.width / 2; })
                //.attr('y', function (d) { return -d.dim.height / 2; })
                .each(function (d) {
                    var el = d3.select(this),
                        body = el.append('xhtml:body').classed('foreign', true);
                    body.text(d.text);
                });

            // show node IDs
            /*g.append('svg:text')
                .attr('x', 0)
                .attr('y', 4)
                .attr('class', 'id')
                .text(function (d) { return d.text; });*/

            // remove old nodes
            circle.exit().remove();

            // set the graph in motion

            nodes.forEach(function (d, i) {
                //d.x = Math.random() * width;
                //d.y = height * i / nodes.length;
                d.x = (width / 2) - (d.dim.width / 2);
                d.y = 0;
            });

            d3.timer(tick);
            //force.start();
            /*for (i = 0; i < 10000; ++i) {
                force.tick();
            }
            force.stop();*/

        };

    // load questions
    $.get(QUESTIONS_LOCATION).done(function (resp) {
        // stateful
        questions = parseTSV(resp);
        visualize(FIRST_QUESTION, questions);
        $start.on('click', function () {
            $('div', $endgame).hide();
            $intro.slideUp();
            $question.show();
            ask(FIRST_QUESTION);
        });
        $reset.on('click', function () {
            $thanks.slideUp('fast', function () {
                $intro.slideDown();
            });
        });
        $doSurvey.on('click', function () {
            $endgame.slideUp('fast', function () {
                $demographics.slideDown();
            });
        });
        $submit.on('click', function () {
            $demographics.slideUp('fast', function () {
                $thanks.slideDown();
            });
        });
    });

    // load demographics (not shown immediately)
    $.get(DEMOGRAPHICS_LOCATION).done(function (resp) {
        var i, j, l, $q, $s,
            submit = function (evt) {
                var $el = $(evt.target),
                    q = $el.parent().text(),
                    a = $el.val();
                if (q && a) {
                    record($el.parent().text(), $el.val());
                }
            };
        resp = resp.split('\n');
        for (i = 0; i < resp.length; i += 1) {
            l = resp[i].split('\t');
            $q = $('<div />').text(l[0]);
            // free response
            if (l.length === 2) {
                $s = $(l[1]);
                if ($s.is('textarea')) {
                    $q.append($s);
                } else {
                    $q.prepend($s);
                }
            // specific options
            } else if (l.length > 2) {
                $s = $('<select />')
                    .append('<option value="" />')
                    .appendTo($q);
                for (j = 1; j < l.length; j += 1) {
                    $s.append($('<option />').attr('value', l[j]).text(l[j]));
                }
            }
            $s.on('blur', submit);
            $demographicsQuestions.append($q);
        }
    });
}());
