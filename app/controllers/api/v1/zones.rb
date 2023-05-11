# frozen_string_literal: true

module Api
  module V1
    class Zones < Grape::API
      include Api::V1::Defaults
      format :json

      helpers do
        # Цвета материалов стен планировки
        COLORS = ['#99d8f0', '#444c1d', '#44251d', '#796f5a', '#a03623', '#999999', '#738595', '#686c5e'].freeze

        # Значения величины затухания сигнала для разных материалов в зависимости от частоты сигнала
        MATERIAL_DAMPING = {
          freq_2: [                                    # частота 2.4ГГц
            { color: '#99d8f0', damping: 2 },          # гипсокартон
            { color: '#444c1d', damping: 3 },          # одиночное стекло
            { color: '#44251d', damping: 13 },         # двойное стекло
            { color: '#796f5a', damping: 4 },          # дерево
            { color: '#a03623', damping: 6 },          # кирпич
            { color: '#999999', damping: [9, 17.5] },  # бетон
            { color: '#738595', damping: 19 },         # металл
            { color: '#686c5e', damping: 22.5 }        # железобетон
          ],
          freq_5: [                                   # частота 5ГГц
            { color: '#99d8f0', damping: 4 },         # гипсокартон
            { color: '#444c1d', damping: 8 },         # одиночное стекло
            { color: '#44251d', damping: 20 },        # двойное стекло
            { color: '#796f5a', damping: 7 },         # дерево
            { color: '#a03623', damping: 10 },        # кирпич
            { color: '#999999', damping: [13, 25] },  # бетон
            { color: '#738595', damping: 32 },        # металл
            { color: '#686c5e', damping: 30 }         # железобетон
          ]
        }.freeze

        # Метод, проверяющий лежат ли точка q на отрезке прямой 'pr'
        # на основе координат каждой из точек
        def onSegment(p, q, r)
          if q[:x] <= [p[:x],
                       r[:x]].max && q[:x] >= [p[:x],
                                               r[:x]].min && q[:y] <= [p[:y], r[:y]].max && q[:y] >= [p[:y], r[:y]].min
            return true
          end

          false
        end

        # Метод, ищущий ориентацию упорядоченного триплета (p, q, r)
        # на основе тангенсов углов наклона отрезков pq и qr
        # Функция возвращает следующие значения
        # 0 -> p, q и r являются коллинеарными
        # 1 -> по часовой стрелке
        # 2 -> против часовой стрелки
        def orientation(p, q, r)
          val = (q[:y] - p[:y]) * (r[:x] - q[:x]) - (q[:x] - p[:x]) * (r[:y] - q[:y])

          return 0 if val.zero? # точки коллинеарны

          val.positive? ? 1 : 2 # точка r лежит в правой или левой полуплоскости относительно луча pq
        end

        # Основная функция, которая возвращает true, если отрезки 'p1q1'
        # и 'p2q2' пересекаются.
        def doIntersect(p1, q1, p2, q2)
          # Находим четыре ориентации, необходимые для общего и частного случаев пересечения отрезков
          o1 = orientation(p1, q1, p2)
          o2 = orientation(p1, q1, q2)
          o3 = orientation(p2, q2, p1)
          o4 = orientation(p2, q2, q1)

          # Общий случай пересечения отрезков
          return true if o1 != o2 && o3 != o4

          # Частные случаи

          # p1, q1 и p2 коллинеарны, а p2 лежит на отрезке p1q1
          return true if o1.zero? && onSegment(p1, p2, q1)

          # p1, q1 и q2 коллинеарны, а q2 лежит на отрезке p1q1
          return true if o2.zero? && onSegment(p1, q2, q1)

          # p2, q2 и p1 коллинеарны, а p1 лежит на отрезке p2q2
          return true if o3.zero? && onSegment(p2, p1, q2)

          # p2, q2 и q1 коллинеарны, а q1 лежит на отрезке p2q2
          return true if o4.zero? && onSegment(p2, q1, q2)

          false # Не попадает ни в один из вышеперечисленных случаев
        end
      end

      resource :zones do
        desc 'Return counted router zones'

        params do
          optional :pixels, type: Array, desc: 'Pixels'
          optional :routers, type: Array, desc: 'Routers'
          optional :walls, type: Array, desc: 'Walls'
          optional :measurements, type: Array, desc: 'Measurements'
          optional :receiver_coef, type: Integer, desc: 'Receiver coefficient'
          optional :wall_scale, type: Float, desc: 'Wall scale'
        end

        post do
          pixels = params[:pixels]
          routers = params[:routers]
          walls = params[:walls]
          receiver_coef = params[:receiver_coef].to_f

          # проверка формата полученных данных без которых невозможно произвести расчеты
          unless pixels.present? && pixels.is_a?(Array) && pixels.all? do |p|
                   p.is_a?(String) && p.size == 7
                 end
            raise StandardError, 'Pixels have incorrect format'
          end
          unless routers.present? && routers.is_a?(Array) && routers.all? do |r|
                   r[:x] && r[:y] && r[:coef] && r[:frequency]
                 end
            raise StandardError, 'Routers have incorrect format'
          end
          unless walls.present? && walls.is_a?(Array) && walls.all? do |w|
                   w[:x] && w[:y] && w[:color] && w[:thickness] && w[:length]
                 end
            raise StandardError, 'Walls have incorrect format'
          end
          if params[:wall_scale].nil? || !params[:wall_scale].is_a?(Float)
            raise StandardError, 'Wall Scale have incorrect format'
          end

          # Расчет константных коэффициентов для каждого из роутеров с целью минимазации производимых вычислений
          routers_coefs = routers.map do |router|
            coef = router[:coef].to_f * receiver_coef * ((3.0 / (router[:frequency].to_f * 10))**2) / (16.0 * (Math::PI**2))
            { coef: coef, frequency: router[:frequency], x: router[:x].to_i, y: router[:y].to_i }
          end

          size = pixels.size
          # расчет уровня сигнала для каждого из пикселей изображенной планировки
          new_pixels = pixels.each_with_index.map do |pixel, i|
            if COLORS.include?(pixel) || pixel == '#99ff99' # пиксель является стеной и сохраняет свой цвет
              pixel
            else
              x = i % 350 # Нахождение координат пикселя на планировке
              y = i / 350 # на основе его индекса в одномерном массиве
              dampings = routers_coefs.map do |router| # расчет величины затухания для каждого из роутеров
                damping = 0 # начальное значение величины затухания сигнала
                router_y = router[:y]
                if size > 350 * 150                 # если на планировке изображен не один этаж
                  y_floor = y / 150                 # находится этаж точки расчета
                  router_floor = router[:y] / 150   # и этаж маршрутизатора
                  router_y += (y_floor - router_floor) * 160
                  damping += 25 * (y_floor - router_floor).abs #начальное значение затухания корректируется в зависимости от кол-ва этажей
                end
                # Рассчет расстояния между маршрутизатором и точкой расчета
                d = Math.sqrt(((x - router[:x])**2) + ((y - router_y)**2)) * params[:wall_scale] / 100.0
                d = 0.01 if d.zero?
                # корректировка затухания на основе расстояния в соответствии с формулой Фрииса
                damping += 10 * Math.log10(router[:coef] / (d**2)).abs 
                walls.each do |wall|    # проверка каждой из стен планировки на предмет пересечения с линией распространения сигнала
                  next unless doIntersect({ x: x, y: y }, { x: router[:x], y: router_y },
                                          wall[:x].symbolize_keys, wall[:y].symbolize_keys) # если не пересекаются, то переходим к следующей стене

                  # Если стена является препятствием на пути распространения сигнала, то величина затухания корректируется на основе ее материала
                  record_damping = if router[:frequency] == '2.4'
                                     MATERIAL_DAMPING[:freq_2].select { |x| x[:color] == wall[:color] }.first[:damping]
                                   else
                                     MATERIAL_DAMPING[:freq_5].select { |x| x[:color] == wall[:color] }.first[:damping]
                                   end
                  damping += if wall[:color] == '#999999'
                               wall[:thickness] < 10 ? record_damping[0] : record_damping[1]
                             else
                               record_damping
                             end
                end
                damping.round(0) # округление затухания до целых чисел
              end
              # конвертация полученного уровня сигнала в цветовой код путем сопоставления
              # цветовой шкалы RGB и шкалы уровня сигнала
              min_damping = dampings.min * 2
              green_code = (0xff - min_damping).to_s(16)
              blue_code = min_damping.to_s(16)
              green_code = "0#{green_code}" if green_code.length == 1
              blue_code = "0#{blue_code}" if blue_code.length == 1
              min_damping < 256 ? "#00#{green_code}#{blue_code}" : '#0000ff'
            end
          end

          # возврат новых цветов планировки в клиентскую часть приложения
          { pixels: new_pixels }
        rescue StandardError => e
          error!({ error: e, code: 338 }, 400) # Обработка ошибки при ее возникновении
        end
      end
    end
  end
end
