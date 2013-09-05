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
        width = 1000,
        height = 1000,
        svg = d3.select('body')
            .append('svg')
            .attr('width', width)
            .attr('height', height),
        $start = $('#start a'),
        $submit = $('#submit a'),
        squareInCircle = 1.8,
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
         * text
         */
        testOuterDimensions = function (text, classes) {
            return Math.log(Math.pow(text.length, 3)) * 5;
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
                            radius: testOuterDimensions(q.Message, 'foreign'),
                            text: q.Message,
                            y: 0,
                            x: width / 2,
                            scale: 1,
                            conflicts: 1,
                            from: [],
                            to: []
                        };

                        // Fix first node at top
                        if (k === firstQuestion) {
                            node.x = width / 2;
                            node.fixed = true;
                        }

                        //node.radius = Math.sqrt(Math.pow(node.dim.width, 2) +
                                                //Math.pow(node.dim.height, 2));
                        //node.angle = Math.atan(node.dim.height / node.dim.width) * 180 / Math.PI;
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
            $('.text', $question).html(question[MESSAGE_COLUMN]);
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

        // test whether two lines intersect (each line is a two-tuple of
        // two-tuples)
        // http://tog.acm.org/resources/GraphicsGems/gemsii/xlines.c
        linesIntersect = function (line1, line2) {
            var x1 = line1[0][0],
                x2 = line1[1][0],
                y1 = line1[0][1],
                y2 = line1[1][1],
                x3 = line2[0][0],
                x4 = line2[1][0],
                y3 = line2[0][1],
                y4 = line2[1][1],

                a1 = y2 - y1,
                b1 = x1 - x2,
                c1 = x2 * y1 - x1 * y2,

                a2 = y4 - y3,
                b2 = x3 - x4,
                c2 = x4 * y3 - x3 * y4,

                r1 = a2 * x1 + b2 * y1 + c2,
                r2 = a2 * x2 + b2 * y2 + c2,
                r3 = a1 * x3 + b1 * y3 + c1,
                r4 = a1 * x4 + b1 * y4 + c1,

                denom = a1 * b2 - a2 * b1,

                offset = denom < 0 ? -denom / 2 : denom / 2,

                xnum,
                ynum;

            // no intersection
            if ((r3 < 0 && r4 < 0) || (r3 > 0 && r4 > 0)) {
                return false;
            }

            // collinear
            if (denom === 0) {
                return false;
            }

            xnum = b1 * c2 - b2 * c1;
            ynum = a2 * c1 - a1 * c2;

            // calculate intersection point
            return [(xnum < 0 ? xnum - offset : xnum + offset) / denom,
                (ynum < 0 ? ynum - offset : ynum + offset) / denom];

        },

        collide = function (node) {
            var nx1 = node.x,
                nx2 = node.x + node.radius,
                ny1 = node.y,
                ny2 = node.y + node.radius;
            return function (quad, x1, y1, x2, y2) {
                if (quad.point && (quad.point !== node)) {
                    var x = node.x - quad.point.x,
                        y = node.y - quad.point.y,
                        l = Math.sqrt(x * x + y * y),
                        r = ((node.radius * node.scale) + (quad.point.radius * quad.point.scale)) * 1.05;
                    if (l < r) {
                        l = (l - r) / (l || 1) * 0.1;
                        node.x -= x *= l;
                        node.y -= y *= l;
                        quad.point.x += x;
                        quad.point.y += y;
                        // only scale non-terminal points down,
                        // favor scaling down non-essential nodes
                        // don't scale stuff less than 50%
                        if (node.to.length > 0 && node.from.length > 0
                                && node.scale > 0.5) {
                            node.scale *= 1 - (0.1 / (node.to.length +
                                                      node.from.length));
                        }
                        if (quad.point.to.length > 0 && quad.point.from.length > 0
                                && quad.point.scale > 0.5) {
                            quad.point.scale *= 1 - (0.1 / (quad.point.to.length +
                                                            quad.point.from.length));
                        }
                    } else {
                        node.scale = node.scale < 1 ? node.scale * 1.005 : 1;
                        quad.point.scale = quad.point.scale < 1 ? quad.point.scale * 1.005 : 1;
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
                force,
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
                    var q = d3.geom.quadtree(nodes.concat(links)),
                        edgePadding = 50,
                        n,
                        i;

                    for (i = 0; i < nodes.length; i += 1) {
                        n = nodes[i];
                        if (n.x - (n.radius * n.scale) < edgePadding) {
                            n.x = (n.x + edgePadding + n.radius * n.scale) / 2;
                        }
                        if (n.y - (n.radius * n.scale) < edgePadding) {
                            n.y = (n.y + edgePadding + n.radius * n.scale) / 2;
                        }
                        if (n.x + n.radius > width - edgePadding) {
                            n.x = (n.x - edgePadding + width - n.radius * n.scale) / 2;
                        }
                        if (n.y + n.radius > height - edgePadding) {
                            n.y = (n.y - edgePadding + height - n.radius * n.scale) / 2;
                        }
                    }

                    for (i = 0; i < nodes.length; i += 1) {
                        q.visit(collide(nodes[i]));
                        //var x;
                    }

                    circle.attr('transform', function (d) {
                        return 'translate(' + d.x + ',' + d.y + ')' +
                            'scale(' + d.scale +  ',' + d.scale + ')';
                    });
                    /*circle.attr("cx", function (d) { return d.x; })
                        .attr("cy", function (d) { return d.y; });*/

                    path.attr('d', function (d) {

                        var deltaX = d.target.x - d.source.x,
                            deltaY = d.target.y - d.source.y,
                            dist = Math.sqrt(deltaX * deltaX + deltaY * deltaY),
                            normX = deltaX / dist,
                            normY = deltaY / dist,
                            sourcePadding = d.source.radius * d.source.scale,
                            targetPadding = d.target.radius * d.target.scale,
                            sourceX = d.source.x + (sourcePadding * normX),
                            sourceY = d.source.y + (sourcePadding * normY),
                            targetX = d.target.x - (targetPadding * normX),
                            targetY = d.target.y - (targetPadding * normY);
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

            g.append('svg:circle')
                .attr('class', function (d) {
                    var klass = 'node';
                    if (d.from.length === 0 || d.to.length === 0) {
                        klass += ' terminal';
                    }
                    return klass;
                })
                .attr('r', function (d) { return d.radius; });

            g.append('svg:foreignObject')
                .attr('width', function (d) { return d.radius * squareInCircle; })
                .attr('height', function (d) { return d.radius * squareInCircle; })
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
                .attr('x', function (d) { return -d.radius * squareInCircle / 2; })
                .attr('y', function (d) { return -d.radius * squareInCircle / 2; })
                .each(function (d) {
                    var el = d3.select(this),
                        body = el.append('xhtml:body').classed('foreign', true);
                    body.html(d.text);
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
                d.x = Math.random() * width;
                d.y = height * i / nodes.length;
                //d.x = (width / 2) - (d.dim.width / 2);
                //d.y = 0;
            });

            //d3.timer(tick);
            force = d3.layout.force()
                .nodes(nodes)
                .links(links)
                .gravity(0)
                // central node -- strong positive charge
                .charge(function (d) {
                    return ((d.from.length + d.to.length) * 20) - 500;
                })
                // central node -- long links
                .linkDistance(function (link) {
                    return (link.target.radius + link.source.radius +
                        Math.pow(link.target.from.length, 2))
                        * (link.target.conflicts + link.source.conflicts) / 2;
                })
                // central node -- strong links
                /*.linkStrength(function (link) {
                    return 10 / link.target.from.length;
                })*/
                .linkStrength(1)
                .size([width, height])
                .on('tick', tick);

            force.start();
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
